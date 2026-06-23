f64 <- function(x) {
  list(type = "f64", values = as.numeric(x))
}

i32 <- function(x) {
  list(type = "i32", values = as.integer(x))
}

u32 <- function(x) {
  list(type = "u32", values = as.integer(x))
}

bool <- function(x) {
  list(type = "bool", values = as.logical(x))
}

enum <- function(indices, labels) {
  list(
    type = "enum",
    values = as.integer(indices),
    enumLabels = as.character(labels)
  )
}

model_output <- function(...) {
  columns <- list(...)
  data <- unname(lapply(columns, function(col) col$values))
  lengths <- vapply(data, length, integer(1))
  if (length(lengths) > 0 && length(unique(lengths)) != 1) {
    stop("cfasim model output columns must have equal length")
  }

  descriptors <- unname(Map(
    function(name, col) {
      descriptor <- list(name = name, type = col$type)
      if (!is.null(col$enumLabels)) {
        descriptor$enumLabels <- col$enumLabels
      }
      descriptor
    },
    names(columns),
    columns
  ))

  list(
    length = if (length(lengths) == 0) 0 else lengths[[1]],
    columns = descriptors,
    data = data
  )
}

model_outputs <- function(...) {
  list(`__modelOutputs` = TRUE, outputs = list(...))
}
