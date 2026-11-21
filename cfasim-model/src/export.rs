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
                pub fn $name(inputs: JsValue) -> Result<JsValue, JsError> {
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

pub fn call<I, R>(name: &str, inputs: JsValue, run: impl FnOnce(I) -> R) -> Result<JsValue, JsError>
where
    I: DeserializeOwned,
    R: IntoOutputs,
{
    // Positional arguments: `run(fn, ...args)` or `runWasm`, or a page on a
    // cfasim-ui release from before named inputs.
    let hint = if inputs.is_object() {
        ""
    } else {
        " (expected an object of named inputs: call it with useOutputs or callWasm, from \
         @cfasim-ui/wasm 0.16 or newer)"
    };
    let inputs: I = serde_wasm_bindgen::from_value(inputs).map_err(|e| {
        // The error is a JS `Error`, which prints with its class name.
        let text = e.to_string();
        let reason = text.strip_prefix("Error: ").unwrap_or(&text);
        JsError::new(&format!("invalid inputs for {name}: {reason}{hint}"))
    })?;
    let outputs = run(inputs).into_outputs().map_err(|e| JsError::new(&e))?;
    Ok(outputs.into_js())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ModelOutput;
    use serde::Deserialize;

    // Deserializing needs a JS engine, so that half is covered by the models
    // and CLI e2e tests.
    #[derive(Deserialize)]
    struct Inputs {
        steps: u32,
        rate: f64,
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
        let inputs = || Inputs {
            steps: 3,
            rate: -1.0,
        };
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
