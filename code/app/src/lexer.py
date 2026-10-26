"""把源码切成 token。"""

from dataclasses import dataclass


@dataclass
class Token:
    kind: str
    text: str


def lex(source: str) -> list[Token]:
    tokens: list[Token] = []
    i = 0
    while i < len(source):
        ch = source[i]
        if ch.isspace():
            i += 1
            continue
        if ch.isdigit():
            j = i
            while j < len(source) and source[j].isdigit():
                j += 1
            tokens.append(Token("num", source[i:j]))
            i = j
            continue
        if ch in "+-*/()":
            tokens.append(Token("op", ch))
            i += 1
            continue
        raise ValueError(f"unexpected {ch!r} at {i}")
    return tokens
