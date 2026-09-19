# Joulo – ERE certificaten

**Netherlands only.** Insight into the ERE certificates you build up by charging your car at home, with [Joulo](https://joulo.nl) as your intermediary.

<a href="https://trmnl.com/recipes/367355"><img width="150" alt="Works with TRMNL" src="https://trmnl.com/images/brand/badges/light/works-with-trmnl/trmnl-badge-works-with-light.svg" /></a>

## Features
- kWh charged and ERE credits per month this year, as a chart
- Year-to-date totals and estimated value in euros
- Current ERE market price (week number included)

## Settings
- **API key:** Joulo dashboard → Settings → Developer → API

Data from the Joulo API; a serverless `transform.js` adds the public ERE price feed and prepares the chart data.

### Develop locally

Templates and settings live in [`src/`](src/), ready for [trmnlp](https://github.com/usetrmnl/trmnlp):

```sh
gem install trmnl_preview
trmnlp serve
```

Questions or ideas? trmnl@achtnegen.nl or @Bastronautica on Discord.
