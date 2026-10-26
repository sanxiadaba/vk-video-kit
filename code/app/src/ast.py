"""AST 节点。"""

from dataclasses import dataclass


@dataclass
class Num:
    value: int


@dataclass
class BinOp:
    op: str
    left: object
    right: object

    def __str__(self) -> str:
        return f"({self.left} {self.op} {self.right})"
