# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "Coś poszło nie tak" [level=1] [ref=e4]
    - paragraph [ref=e5]: Wystąpił błąd aplikacji. Spróbuj odświeżyć stronę albo wrócić później. Jeśli problem się powtarza – zgłoś go administratorowi.
    - button "Spróbuj ponownie" [ref=e6]
  - alert [ref=e7]
  - generic [ref=e12] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e13]:
      - img [ref=e14]
    - generic [ref=e17]:
      - button "Open issues overlay" [ref=e18]:
        - generic [ref=e19]:
          - generic [ref=e20]: "3"
          - generic [ref=e21]: "4"
        - generic [ref=e22]:
          - text: Issue
          - generic [ref=e23]: s
      - button "Collapse issues badge" [ref=e24]:
        - img [ref=e25]
```