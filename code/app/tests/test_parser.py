from src.parser import parse


def test_precedence() -> None:
    assert str(parse("1 + 2 * 3")) == "(1 + (2 * 3))"


def test_parens() -> None:
    assert str(parse("(1 + 2) * 3")) == "((1 + 2) * 3)"
