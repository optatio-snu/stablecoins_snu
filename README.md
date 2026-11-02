# Stablecoin Lab

A static, browser-based research interface for USDC and USDT peg-price diagnostics.

## Run it

Open `index.html`, or publish all seven files at the root of a GitHub Pages / Cloudflare Pages project. The Literature and VAR / HANK pages link from the main page. No build step, account, key, package install, or paid service is required.

## Data and cost

The page reads the public DeFiLlama stablecoin catalog and price-history endpoints from the browser:

- `https://stablecoins.llama.fi/stablecoins?includePrices=true`
- `https://coins.llama.fi/chart/coingecko:usd-coin?span=90&period=86400` (or `coingecko:tether`)

These are the no-key public endpoints documented by DeFiLlama. The site does not call paid endpoints, use yfinance, or send an API key. API access cost: **$0**. Public endpoint availability and rate limits are outside this site's control.

## Specification

The overview compares AR(p), p=1..8, orders with pooled BIC or AICc across USDC and USDT; fixed AR(4) is available for comparison. The equation is `d_t = α + Σ φ_j d_(t−j) + ε_t`, where `d_t = (price_t − 1) × 10,000` basis points. OLS coefficients use Newey–West HAC standard errors; reported p-values use a normal approximation. Its forecast band is a descriptive residual-based band, not a calibrated prediction interval. The separate VAR / HANK page supports CSV-imported macro series, reduced-form VAR, recursive Cholesky SVAR, Minnesota-prior BVAR, and a deliberately small two-household HANK-style sensitivity panel. These are exploratory implementations, not substitutes for a fully specified and validated research estimation pipeline. The money-multiplier panel is an explicit accounting sensitivity, not a causal estimate.

Price and circulating-supply observations do not identify reserve liquidity, redemption queues, or arbitrage access. The interface does not claim causal run-risk estimates. Price CSV import expects `date,price` and may include `supply` (USD units). Macro CSV import expects a date column and selected numeric series such as `usdc_peg_bp`, `usdt_peg_bp`, `fedfunds`, `inflation`, `treasury3m`, and `money_multiplier`.

## Research references

- Ma, Zeng & Zhang (2025), [Stablecoin Runs and the Centralization of Arbitrage](https://www.nber.org/papers/w33882), NBER WP 33882.
- Gorton et al. (2022), [Leverage and Stablecoin Pegs](https://www.nber.org/papers/w30796), NBER WP 30796.
- Ahmed et al. (2025), [Stablecoins: A Revolutionary Payment Technology with Financial Risks](https://www.nber.org/papers/w34475), NBER WP 34475.
- Bordo & Wilkins (2026), [Money and Power: Historical Lessons for Stablecoins and U.S. Dollar Dominance](https://www.nber.org/papers/w35768), NBER WP 35768.
- Shleifer & Vishny (2010), [Fire Sales in Finance and Macroeconomics](https://www.nber.org/papers/w16642), NBER WP 16642.

