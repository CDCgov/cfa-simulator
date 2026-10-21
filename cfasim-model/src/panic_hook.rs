//! Panic reporting for browser models.
//!
//! A Rust panic in WebAssembly aborts with an `unreachable` trap, so the only
//! thing JavaScript sees is `RuntimeError: unreachable`. The hook installed by
//! [`__cfasim_install_panic_hook`] keeps the last panic's message and location
//! so the `@cfasim-ui/wasm` worker can read it back with
//! [`__cfasim_take_panic`] and report `panicked at src/lib.rs:21:9: ...`
//! instead. Both are called by the worker, never by model code.

use std::cell::RefCell;
use std::sync::Mutex;
#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

// The hook is process-global but `take_panic` runs on the thread that made
// the call, so the text is kept per thread and, for a panic on another
// thread (wasm-bindgen-rayon, a native task's spawned thread), globally.
thread_local! {
    static LAST_PANIC: RefCell<Option<String>> = const { RefCell::new(None) };
}
static LAST_PANIC_ANY: Mutex<Option<String>> = Mutex::new(None);

/// The hook info's `Display` (`panicked at <file>:<line>:<col>:\n<message>`)
/// joined onto one line. Taking the rendered text keeps this off the
/// `PanicInfo` / `PanicHookInfo` rename (Rust 1.81).
pub fn describe_panic(rendered: &str) -> String {
    rendered.replacen(":\n", ": ", 1)
}

/// Chain a recording hook in front of the current panic hook. Any hook the
/// model installed itself (such as `console_error_panic_hook`) still runs.
pub fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let text = describe_panic(&info.to_string());
        if let Ok(mut slot) = LAST_PANIC_ANY.try_lock() {
            *slot = Some(text.clone());
        }
        LAST_PANIC.with(|last| {
            if let Ok(mut slot) = last.try_borrow_mut() {
                *slot = Some(text);
            }
        });
        previous(info);
    }));
}

/// The last recorded panic, cleared on read: this thread's, else any
/// thread's.
pub fn take_panic() -> Option<String> {
    let local = LAST_PANIC.with(|last| last.try_borrow_mut().ok().and_then(|mut slot| slot.take()));
    let any = LAST_PANIC_ANY
        .try_lock()
        .ok()
        .and_then(|mut slot| slot.take());
    local.or(any)
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn __cfasim_install_panic_hook() {
    install_panic_hook();
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn __cfasim_take_panic() -> Option<String> {
    take_panic()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    // The hook is process-global and other tests in this binary panic on
    // purpose in parallel, so the previous hook counts calls (no lock a
    // failed assertion could hold while the hook re-enters it) and then
    // runs the default hook so a neighbor's failure still prints, and the
    // assertions allow calls from those threads. `LAST_PANIC` is per thread.
    #[test]
    fn records_and_chains() {
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_in_hook = Arc::clone(&calls);
        let default_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            calls_in_hook.fetch_add(1, Ordering::SeqCst);
            default_hook(info);
        }));
        install_panic_hook();

        // The thread-local slot wins over the global one, which a neighbor
        // may fill at any time, so these reads are deterministic.
        let result = std::panic::catch_unwind(|| panic!("rate must be <= 5, got {}", 9));
        assert!(result.is_err());
        let calls_seen = calls.load(Ordering::SeqCst);

        let text = take_panic().expect("panic recorded");
        assert!(text.ends_with(": rate must be <= 5, got 9"), "{text}");
        assert!(text.starts_with("panicked at "), "{text}");
        assert!(text.contains("panic_hook.rs:"), "{text}");
        assert!(calls_seen >= 1, "previous hook ran {calls_seen} times");

        let _ = std::panic::catch_unwind(|| panic!("second"));
        let text = take_panic().expect("second panic recorded");
        assert!(text.ends_with(": second"), "{text}");

        let _ = std::panic::take_hook();

        // A panic on another thread is still readable from this one.
        LAST_PANIC_ANY.lock().unwrap().take();
        std::thread::spawn(|| {
            let _ = std::panic::catch_unwind(|| panic!("elsewhere"));
        })
        .join()
        .unwrap();
        let text = LAST_PANIC_ANY.lock().unwrap().take();
        assert!(
            text.is_none(),
            "hook was removed, so nothing recorded: {text:?}"
        );
        install_panic_hook();
        std::thread::spawn(|| {
            let _ = std::panic::catch_unwind(|| panic!("elsewhere"));
        })
        .join()
        .unwrap();
        let text = take_panic().expect("other thread's panic recorded");
        assert!(text.starts_with("panicked at "), "{text}");
        let _ = std::panic::take_hook();
    }
}
