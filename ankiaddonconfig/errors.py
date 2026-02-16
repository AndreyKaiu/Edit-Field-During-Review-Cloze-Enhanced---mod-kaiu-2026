from typing import Any

from ..localization.lang import q

class InvalidConfigValueError(Exception):
    def __init__(self, key: str, expected: str, value: Any):
        self.key = key
        self.expected = expected
        self.value = value

    def __str__(self) -> str:
        return f"{q("q_For_config")}: {self.key}\n{q("q_expected_value_is")}: {self.expected}\n{q("q_but_instead_encountered")}: {self.value}"
