import sys

from cfasim_model.server.capture import LineWriter, capture_output


def make(stream="stdout"):
    posted = []
    clock = {"t": 0.0}
    w = LineWriter(stream, posted.append, "run", clock=lambda: clock["t"])
    return w, posted, clock


def lines(posted):
    return [(e["line"], e["overwrite"]) for e in posted]


def test_newline_terminated_lines():
    w, posted, _ = make()
    w.write("hello\nwor")
    w.write("ld\n")
    assert lines(posted) == [("hello", False), ("world", False)]
    assert all(e["stream"] == "stdout" and e["type"] == "log" for e in posted)


def test_carriage_return_updates_are_overwrite_events_then_final_line():
    w, posted, clock = make("stderr")
    w.write("10%\r")
    clock["t"] += 1
    w.write("20%\r")
    clock["t"] += 1
    w.write("100%\n")
    assert lines(posted) == [("10%", True), ("20%", True), ("100%", False)]
    assert posted[0]["stream"] == "stderr"


def test_overwrite_events_are_throttled():
    w, posted, clock = make()
    for i in range(10):
        w.write(f"{i}\r")
    clock["t"] += 1
    w.write("done\r")
    assert lines(posted) == [("0", True), ("done", True)]


def test_carriage_return_output_does_not_accumulate():
    w, posted, _ = make("stderr")
    for i in range(20_000):
        w.write(f"\r{i:>6}/20000")
    assert len(w._pending) < 50
    w.write("\n")
    assert lines(posted)[-1] == (" 19999/20000", False)
    # A bar that ends on "\r" still logs its last state at finish.
    w.write("\rfinal\r")
    w.finish()
    assert lines(posted)[-1] == ("final", False)


def test_ansi_is_stripped():
    w, posted, _ = make()
    w.write("\x1b[31mred\x1b[0m\n")
    assert lines(posted) == [("red", False)]


def test_capture_output_swaps_streams():
    posted = []
    before = sys.stdout, sys.stderr
    with capture_output(posted.append, "run"):
        print("out")
        sys.stderr.write("err\n")
        assert not sys.stdout.isatty()
    assert (sys.stdout, sys.stderr) == before
    assert sorted((e["stream"], e["line"]) for e in posted) == [
        ("stderr", "err"),
        ("stdout", "out"),
    ]
