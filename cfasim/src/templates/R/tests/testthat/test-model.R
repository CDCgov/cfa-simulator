source(file.path("..", "..", "R", "model.R"))

test_that("compute_series creates matching time and value vectors", {
  series <- compute_series(steps = 4, rate = 3)

  expect_equal(series$time, c(0, 1, 2, 3))
  expect_equal(series$values, c(0, 3, 6, 9))
})
