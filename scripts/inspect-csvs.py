"""Print the first ~10 rows of every CSV so we can write parsers grounded in real structure."""
import csv
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "sample-data"
FILES = [
    "pmweb_all_data_export.csv",
    "kfasts_proj_trans_detail.csv",
    "invoice_summary.csv",
    "task_summary.csv",
    "task_budget.csv",
    "etc.csv",
    "invoice_log.csv",
    "change_log.csv",
    "sub_management.csv",
    "staff.csv",
    "notes.csv",
    "check_detail.csv",
    "tables.csv",
    "jtd_revenue_by_period.csv",
    "hours_by_staff.csv",
]


def show(fname, head_rows=8):
    p = OUT / fname
    print(f"\n=== {fname} ===")
    with open(p, encoding="utf-8") as f:
        rdr = csv.reader(f)
        for i, row in enumerate(rdr):
            if i >= head_rows:
                break
            # truncate huge rows for readability
            disp = row[:14]
            print(f"r{i} ({len(row)} cols): {disp}")


def main():
    for fname in FILES:
        show(fname)


if __name__ == "__main__":
    main()
