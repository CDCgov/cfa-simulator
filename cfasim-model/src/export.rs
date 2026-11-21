//! Named inputs for browser models: the glue behind [`export!`](crate::export!).

use std::fmt::Display;

use serde::de::DeserializeOwned;
use wasm_bindgen::prelude::*;

use crate::Outputs;

/// Export model functions to the page with named inputs.
///
/// Each function takes one inputs struct, deserialized from the object the
/// page passes to `useOutputs` (or `callWasm`), and returns [`Outputs`] or a
/// `Result` of them. Fields are matched by name, so the order of the page's
/// keys does not matter, and they can hold anything JSON can: numbers,
/// booleans, strings, arrays, nested structs.
///
/// ```
/// use cfasim_model::{export, ModelOutput, Outputs};
/// use serde::Deserialize;
///
/// #[derive(Deserialize)]
/// struct SimulateInputs {
///     steps: u32,
///     rate: f64,
/// }
///
/// fn simulate(inputs: SimulateInputs) -> Outputs {
///     let values: Vec<f64> = (0..inputs.steps).map(|t| t as f64 * inputs.rate).collect();
///     Outputs::new().add("series", ModelOutput::new(values.len()).add_f64("values", values))
/// }
///
/// export!(simulate);
/// # fn main() {}
/// ```
///
/// The functions stay plain Rust, so `cargo test` can call them directly. An
/// `Err` reaches the page as the `error` of `useOutputs`, as does a missing
/// or mistyped field. Keys the struct does not declare are ignored unless it
/// has `#[serde(deny_unknown_fields)]`; `#[serde(default)]` makes fields
/// optional.
///
/// Invoke it once, at the crate root, listing every exported function:
/// `export!(simulate, simulate_batch);`.
#[macro_export]
macro_rules! export {
    ($($name:ident),+ $(,)?) => {
        #[doc(hidden)]
        mod __cfasim_exports {
            use $crate::__private::wasm_bindgen;
            use $crate::__private::wasm_bindgen::prelude::{wasm_bindgen, JsError, JsValue};

            $(
                #[wasm_bindgen]
                pub fn $name(inputs: &str) -> Result<JsValue, JsError> {
                    $crate::__private::call(stringify!($name), inputs, super::$name)
                }
            )+

            /// Tells the worker which exports take named inputs.
            #[wasm_bindgen]
            pub fn __cfasim_named_inputs() -> String {
                [$(stringify!($name)),+].join(",")
            }
        }
    };
}

/// What an exported model function may return.
pub trait IntoOutputs {
    fn into_outputs(self) -> Result<Outputs, String>;
}

impl<T: Into<Outputs>> IntoOutputs for T {
    fn into_outputs(self) -> Result<Outputs, String> {
        Ok(self.into())
    }
}

impl<T: Into<Outputs>, E: Display> IntoOutputs for Result<T, E> {
    fn into_outputs(self) -> Result<Outputs, String> {
        self.map(Into::into).map_err(|e| e.to_string())
    }
}

/// Deserialize the page's inputs object for the function `name`.
pub fn parse_inputs<I: DeserializeOwned>(name: &str, json: &str) -> Result<I, String> {
    serde_json::from_str(json).map_err(|e| {
        let mut message = format!("invalid inputs for {name}: {e}");
        if !json.trim_start().starts_with('{') {
            // An older page spreads its params as positional arguments.
            message.push_str(
                " (expected a JSON object of named inputs; \
                 update @cfasim-ui/wasm if the page still calls positionally)",
            );
        }
        message
    })
}

pub fn call<I, R>(name: &str, json: &str, run: impl FnOnce(I) -> R) -> Result<JsValue, JsError>
where
    I: DeserializeOwned,
    R: IntoOutputs,
{
    let inputs = parse_inputs(name, json).map_err(|e| JsError::new(&e))?;
    let outputs = run(inputs).into_outputs().map_err(|e| JsError::new(&e))?;
    Ok(outputs.into_js())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ModelOutput;
    use serde::Deserialize;

    #[derive(Deserialize, Debug, PartialEq)]
    struct Group {
        label: String,
        size: u32,
    }

    #[derive(Deserialize, Debug, PartialEq)]
    struct Inputs {
        steps: u32,
        rate: f64,
        #[serde(default)]
        stochastic: bool,
        #[serde(default)]
        contacts: Vec<Vec<f64>>,
        #[serde(default)]
        groups: Vec<Group>,
    }

    #[test]
    fn fields_match_by_name_in_any_order() {
        let inputs: Inputs = parse_inputs("simulate", r#"{"rate": 2.5, "steps": 10}"#).unwrap();
        assert_eq!(inputs.steps, 10);
        assert_eq!(inputs.rate, 2.5);
    }

    #[test]
    fn carries_booleans_arrays_and_nested_values() {
        let json = r#"{
            "steps": 1,
            "rate": 0.5,
            "stochastic": true,
            "contacts": [[1.0, 0.2], [0.2, 1.0]],
            "groups": [{"label": "adults", "size": 80}],
            "uiOnly": "ignored"
        }"#;
        let inputs: Inputs = parse_inputs("simulate", json).unwrap();
        assert!(inputs.stochastic);
        assert_eq!(inputs.contacts, vec![vec![1.0, 0.2], vec![0.2, 1.0]]);
        assert_eq!(
            inputs.groups,
            vec![Group {
                label: "adults".into(),
                size: 80
            }]
        );
    }

    #[test]
    fn a_missing_field_is_named() {
        let error = parse_inputs::<Inputs>("simulate", r#"{"steps": 10}"#).unwrap_err();
        assert!(
            error.starts_with("invalid inputs for simulate: missing field `rate`"),
            "{error}"
        );
        assert!(!error.contains("positionally"), "{error}");
    }

    #[test]
    fn a_positional_call_gets_a_hint() {
        let error = parse_inputs::<Inputs>("simulate", "10").unwrap_err();
        assert!(error.contains("expected a JSON object"), "{error}");
    }

    fn simulate(inputs: Inputs) -> Outputs {
        Outputs::new().add("series", ModelOutput::new(inputs.steps as usize))
    }

    fn fallible(inputs: Inputs) -> Result<Outputs, String> {
        if inputs.rate < 0.0 {
            return Err("rate must not be negative".into());
        }
        Ok(simulate(inputs))
    }

    crate::export!(simulate, fallible);

    #[test]
    fn export_lists_the_named_functions() {
        assert_eq!(
            __cfasim_exports::__cfasim_named_inputs(),
            "simulate,fallible"
        );
    }

    #[test]
    fn return_values_convert_to_outputs() {
        let inputs = || parse_inputs::<Inputs>("simulate", r#"{"steps": 3, "rate": -1}"#).unwrap();
        assert_eq!(
            simulate(inputs()).into_outputs().unwrap().names(),
            ["series"]
        );
        assert_eq!(
            fallible(inputs()).into_outputs().err().as_deref(),
            Some("rate must not be negative")
        );
        let pairs = [("table", ModelOutput::new(0))];
        assert_eq!(pairs.into_outputs().unwrap().names(), ["table"]);
    }
}
