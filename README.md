# LevelSpend: a level-spending retirement solver

A single-file retirement planner based on amortization: it computes the level
real (inflation-adjusted) spending that your portfolio, savings, pension,
and Social Security can sustain from now through a chosen end age, with the portfolio depleting to a chosen legacy amount (zero by default) exactly at that age.

It answers two questions directly:

- **Given my savings rate, what is the earliest retirement age at which my
  spending can stay level for life?**
- **Given my chosen retirement age, what savings rate makes it work?**

Both are solved directly and applied with one click.

## Use it

**[Open the tool](https://levelspend.github.io/)** in your browser, or
download `index.html` and open it locally. It is one self-contained file with
no dependencies, no server, and no build step. Nothing you enter leaves your
browser; there is no tracking, storage, or network activity of any kind.
Step-by-step instructions for working, retired, and semi-retired users are at
the bottom of the page.

The tool is intended to be revisited: once a year, or after any major change
in your finances, refresh the inputs (age, portfolio value, and current
benefit estimates) and read off the recalculated plan.

## What it deliberately does not model

- **Taxes.** All amounts are pre-tax. Withdrawals from traditional (pre-tax)
  accounts are spendable only after income tax.
- **Required minimum distributions and account types.**
- **Market volatility.** There is no simulation and no distribution of
  outcomes. The model takes the return as given: a single steady real return
  by default, or a path you draw or type year by year under Advanced. No one
  knows the return in advance; try several and see how much the results move.

These omissions are intentional. The tool answers one question and answers it transparently: given an assumed return, what level of real spending is consistent with your resources? The whole model is about 250 lines of readable JavaScript inside the file, 400 with its comments, marked off by a comment that begins `---- model ----`.

## Method

Retirement spending is the annuity payment that amortizes the
retirement-date portfolio, plus the present value of future pension and
Social Security, minus the present value of any legacy, over the remaining
horizon.

By default the plan never spends money it does not have. When income arrives
later than it is needed, holding spending level would mean borrowing against
a benefit that has not started, so spending instead holds as level as
possible and steps up when the later income arrives.

Both solves aim at the first year of the plan the chart draws, rather than at
a level plan the no-borrow rule forbids. What each can then deliver differs.
The savings rate is a continuous dial, so its solve lands exactly: the two
spending amounts match to the dollar whenever a level rate exists between 0
and 100%. That solve is a closed form when the plan is fully level, and a
bisection on the first segment when the no-borrow rule splits it. The
retirement age is a whole number, so its solve returns the year closest to
level and a step usually remains. On the working example it returns 62, where
retirement spending falls about $1,400 short of working spending; the level
point itself falls at age 62.6.

## Tests

The model has a test suite: run node test/model.test.mjs with Node.js. It needs Node and nothing else to install. On each run the suite slices the model region out of index.html and imports it, so the code under test is the file itself, and it checks 80 assertions against it, from the Social Security claiming factor table to the terminal balance landing on the legacy amount.

## Feedback / Contact

Active in the [Bogleheads discussion thread](https://www.bogleheads.org/forum/viewtopic.php?t=473403), which is usually the fastest way to reach me.
For anything else: levelspend@proton.me

## Disclaimer

For illustrative and educational purposes only. Not intended as financial,
investment, tax, or legal advice. No guarantees are made as to the accuracy of
the information on this site or the appropriateness of any advice to your
particular situation. Consult a qualified professional before making financial
decisions.
