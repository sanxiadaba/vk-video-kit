"""把 token 变成 AST。"""

from .ast import BinOp, Num
from .lexer import lex


def parse(source: str):
    tokens = lex(source)
    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def expr():
        nonlocal pos
        left = term()
        while peek() and peek().text in "+-":
            op = tokens[pos].text
            pos += 1
            left = BinOp(op, left, term())
        return left

    def term():
        nonlocal pos
        left = factor()
        while peek() and peek().text in "*/":
            op = tokens[pos].text
            pos += 1
            left = BinOp(op, left, factor())
        return left

    def factor():
        nonlocal pos
        token = peek()
        if token is None:
            raise SyntaxError("unexpected end")
        if token.kind == "num":
            pos += 1
            return Num(int(token.text))
        if token.text == "(":
            pos += 1
            node = expr()
            if peek() is None or peek().text != ")":
                raise SyntaxError("missing )")
            pos += 1
            return node
        raise SyntaxError(f"unexpected {token.text!r}")

    tree = expr()
    if peek() is not None:
        raise SyntaxError("trailing input")
    return tree
