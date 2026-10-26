from src.lexer import lex


def test_numbers() -> None:
    assert [t.text for t in lex("1 + 2")] == ["1", "+", "2"]


def test_unknown_char() -> None:
    try:
        lex("1 $ 2")
    except ValueError:
        pass
    else:
        raise AssertionError("should reject $")
