compute_series <- function(steps, rate) {
  time <- seq(0, steps - 1)
  values <- time * rate
  list(time = time, values = values)
}

simulate <- function(steps, rate) {
  series <- compute_series(steps, rate)
  model_outputs(
    series = model_output(
      time = f64(series$time),
      values = f64(series$values)
    )
  )
}
