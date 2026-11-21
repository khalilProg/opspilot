# OpsPilot dashboard design

OpsPilot is an operator console. Start with current endpoint health, then give the operator a short path to an affected monitor or incident. Keep configuration and historical detail close to their records.

## Foundations

- Use the semantic Tailwind tokens in `frontend/src/styles.css`. Dark mode uses graphite canvas `#15151d`, surface `#1c1c26`, and violet action color `#bbaaf8`. The light theme maps the same roles to a light canvas and a deeper violet.
- Reserve green, rose, and amber for operational, failed, and attention states. Pair color with a visible state label or legend.
- Use the UI sans stack throughout, with tabular numerals for readings and counts. Keep body text at 16px and secondary labels at 14px where space allows.
- Align content on an 8px rhythm with 4px increments inside compact controls. Use borders to separate panels and rows. Use the small radius for controls and the larger radius for groups of information.
- Use Lucide icons alongside labels. Name controls that use an icon alone. Keep controls visible on keyboard focus and reduce transitions when the device requests reduced motion.

## Views

- **Overview** pairs current availability with two supporting counts. The bar shows the distribution of Up, Down, and Unknown among enabled monitors. The adjacent percentage uses only monitors with known states.
- **Monitors** uses a compact count strip and URL-backed status and search filters.
- **Monitor details** puts the measured response-time trend and its check table first. Rose markers identify failed checks.
- **Incidents** separates active and resolved work. The detail view shows acknowledgement, recovery, and their recorded transitions.
- **Settings** offers Dark, Light, and System appearance. The browser stores the selection.
