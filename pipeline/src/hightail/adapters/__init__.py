"""Post-v1 source adapters (legal-review gate; never v1 default data).

Callers must set ``HIGHTAIL_ADAPTER_LICENSE_OK=1`` and pass a local,
uncommitted source file. Adapters never download contested tables.
"""

from hightail.adapters.becker import load_becker
from hightail.adapters.gate import (
    DEFAULT_IQ_METRIC_LABEL,
    LICENSE_ENV,
    AdapterError,
    AdapterLicenseError,
    AdapterResult,
    require_adapter_license,
    write_estimates_csv,
)
from hightail.adapters.pisa import PISA_METRIC_LABEL, load_pisa

__all__ = [
    "DEFAULT_IQ_METRIC_LABEL",
    "LICENSE_ENV",
    "PISA_METRIC_LABEL",
    "AdapterError",
    "AdapterLicenseError",
    "AdapterResult",
    "load_becker",
    "load_pisa",
    "require_adapter_license",
    "write_estimates_csv",
]
