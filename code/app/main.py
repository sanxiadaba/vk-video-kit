from src.parser import parse


def main() -> None:
    tree = parse("1 + 2 * 3")
    print(tree)


if __name__ == "__main__":
    main()
