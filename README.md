# Stablecoin Lab

A static, browser-based research interface for USDC and USDT peg-price diagnostics.

## Run it

Open `index.html`, or publish the three site files at the root of a GitHub Pages / Cloudflare Pages project. No build step, account, key, package install, or paid service is required.

## Data and cost

The page reads the public DeFiLlama stablecoin catalog and price-history endpoints from the browser:

- `https://stablecoins.llama.fi/stablecoins?includePrices=true`
- `https://coins.llama.fi/chart/coingecko:usd-coin?span=90&period=86400` (or `coingecko:tether`)

These are the no-key public endpoints documented by DeFiLlama. The site does not call paid endpoints, use yfinance, or send an API key. API access cost: **$0**. Public endpoint availability and rate limits are outside this site's control.

## Specification

The transparent descriptive baseline is `d_t = α + ρ d_(t−1) + ε_t`, where `d_t = (price_t − 1) × 10,000` basis points. Coefficients are estimated by OLS; reported standard errors use a Newey–West HAC covariance estimator with a rule-of-thumb lag length. The displayed p-values use a normal approximation. The scenario panel applies a user-set initial shock to the fitted AR(1) path. Supply outflow is reported separately and is not treated as a causal price effect.

Price and circulating-supply observations do not identify reserve liquidity, redemption queues, or arbitrage access. The interface deliberately does not invent reserve ratios or claim causal run-risk estimates. Imported CSV files should include `date,price` and may include `supply` (USD units).

## Research references

- Ma, Zeng & Zhang (2025), [Stablecoin Runs and the Centralization of Arbitrage](https://www.nber.org/papers/w33882), NBER WP 33882.
- Gorton et al. (2022), [Leverage and Stablecoin Pegs](https://www.nber.org/papers/w30796), NBER WP 30796.
- Ahmed et al. (2025), [Stablecoins: A Revolutionary Payment Technology with Financial Risks](https://www.nber.org/papers/w34475), NBER WP 34475.
- Bordo & Wilkins (2026), [Money and Power: Historical Lessons for Stablecoins and U.S. Dollar Dominance](https://www.nber.org/papers/w35768), NBER WP 35768.
- Shleifer & Vishny (2010), [Fire Sales in Finance and Macroeconomics](https://www.nber.org/papers/w16642), NBER WP 16642.
