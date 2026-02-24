---
name: ai-cost-aware-generation
description: LLM/RAG 기반 생성 기능을 저비용으로 설계하는 패턴
---

# AI Cost-aware Generation (저비용 LLM/RAG)

## 원칙
- "항상 새로 생성" 대신 **캐시 + 증분 업데이트**
- LLM 입력은 최소화: 원문 전체를 넣지 말고, 필요한 chunk만.
- 출력은 반드시 JSON 스키마로(구조화) → 저장/검증/재사용

## 저비용 설계 체크리스트
- [ ] 업로드 텍스트를 정규화(공백/헤더/푸터 제거)
- [ ] Chunking: 500~1,000 token 단위 + overlap (초기값)
- [ ] 임베딩은 chunk 단위로 1회만, 결과 저장
- [ ] 퀴즈 생성도 chunk 단위로, 결과 저장
- [ ] 오답노트는 “사용자 답” + “해당 개념 chunk”만 넣고 생성

## 실패 비용 줄이기
- LLM 호출 전에 rule-based validation(길이/금칙어/스키마) 먼저
- JSON 파싱 실패 대비: 재시도 프롬프트/repair 단계 분리

## 추후 확장
- 모델/벤더 추상화(Claude/OpenAI/로컬) 인터페이스로 교체 가능하게

