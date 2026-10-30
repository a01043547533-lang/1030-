# 검색 노출 설정

## 적용된 내용

- 페이지별로 다른 HTML 제목과 설명, 한국어 언어·OG 메타데이터
- 실제 기능만 기술한 WebApplication·WebPage 구조화 데이터
- 공개 일정 10건과 공식 출처를 담은 `guide.html`
- 화면에 표시한 질문·답변과 일치하는 FAQPage 구조화 데이터
- 플래너·학교 일정·이용 안내의 상호 링크

개인 일정과 체크리스트는 브라우저 localStorage에만 저장됩니다. 공개 안내 페이지에는 기본 공식 일정만 들어갑니다.

## 배포 주소 확정 후

1. GitHub Pages의 실제 HTTPS 주소를 확인합니다.
2. `node scripts/configure-site.mjs 실제배포주소`를 실행합니다.
3. 생성된 canonical·og:url·sitemap.xml·robots.txt와 세 HTML 파일을 배포합니다.
4. Google Search Console·Bing Webmaster Tools에서 본인 사이트를 확인하고 sitemap을 제출합니다. 계정 소유자 확인과 색인 신청은 아직 수행하지 않았습니다.

로컬 주소나 가상의 주소는 canonical·sitemap에 넣지 않았습니다. GitHub Pages 프로젝트 사이트의 robots.txt는 도메인 루트의 robots.txt를 대신하지 않으므로, URL 검사 도구에서 실제 크롤링 허용 여부를 확인해야 합니다.

## 한계

메타데이터·구조화 데이터는 검색엔진이 페이지를 이해하도록 돕습니다. 검색 순위, 리치 결과 또는 AI 답변 인용을 보장하지 않습니다. FAQPage 마크업을 넣었다고 FAQ 리치 결과에 자동 노출되는 것도 아닙니다. 별도의 AI 전용 태그나 숨긴 키워드를 넣지 않았습니다.

공식 참고: [Google AI 검색 안내](https://developers.google.com/search/docs/appearance/ai-features), [Google 제목 안내](https://developers.google.com/search/docs/appearance/title-link), [Bing 웹마스터 안내](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a).
