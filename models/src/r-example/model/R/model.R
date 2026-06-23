simulate <- function(steps, rate) {
  time <- seq(0, steps - 1)
  values <- time * rate
  model_outputs(
    series = model_output(
      time = f64(time),
      values = f64(values)
    )
  )
}
