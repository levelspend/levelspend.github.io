# LevelSpend — a level-spending retirement solver

A single-file retirement planner based on amortization: it computes the level
real (inflation-adjusted) consumption that your portfolio, savings, pension,
and Social Security can sustain from now through a chosen end age, with the portfolio depleting to a chosen legacy amount (zero by default) exactly at that age.

It answers two questions directly:

- **Given my savings rate, what is the earliest retirement age at which my
  spending can stay level for life?**
- **Given my chosen retirement age, what savings rate makes it work?**

Both are solved in closed form and applied with one click.

## Use it

**[Open the tool](https://levelspend.github.io/)** in your browser, or
download `index.html` and open it locally. It is one self-contained file with
no dependencies, no server, and no build step. Nothing you enter leaves your
browser; there is no tracking, storage, or network activity of any kind.
Step-by-step instructions for both working and retired users are at the bottom
of the page.

The tool is intended to be revisited: once a year, or after any major change
in your finances, refresh the inputs (age, portfolio value, and current
benefit estimates) and read off the recalculated plan.

## What it deliberately does not model

- **Taxes.** All amounts are pre-tax. Withdrawals from traditional (pre-tax)
  accounts are spendable only after income tax.
- **Required minimum distributions and account types.**
- **Market volatility.** The model uses a single steady real return that you
  choose. No one knows this rate in advance; try several values and see how much the results move.

These omissions are intentional. The tool answers one question and answers it transparently: given a steady real return, what level of real spending is consistent with your resources? The complete model fits in about 80 lines of readable JavaScript inside the file.
## Method

Retirement consumption is the annuity payment that amortizes the retirement-date portfolio, plus the present value of future pension and Social Security, minus the present value of any legacy, over the remaining horizon. The savings-rate solve sets working
consumption (salary minus savings) equal to retirement consumption and solves
in closed form; the retirement-age solve gives the latest whole-year age at
which retirement spending does not exceed working spending (the exact,
non-integer level point is shown alongside it). Cash flows use an annual, end-of-year convention.
The equations are documented in a comment inside the file.

## Feedback / Contact

Active in the [Bogleheads discussion thread](https://www.bogleheads.org/forum/viewtopic.php?t=473403) — that's usually the fastest way to reach me.
For anything else: levelspend@proton.me
