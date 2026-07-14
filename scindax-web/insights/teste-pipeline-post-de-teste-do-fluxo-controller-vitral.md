# [TESTE PIPELINE] Post de teste do fluxo Controller -> Vitral

---
subtitle: Validação manual do commit automático de publicar_local
image_query: abstract dark texture
tags: teste, pipeline, controller
---

Este post existe só pra validar, de ponta a ponta, que o Controller escreve
o artefato aprovado dentro do repositório espelhado e faz o commit local --
sem depender de geração por IA (bloqueada agora por cota/config, não por bug).

## Decisão 1: pular a geração por IA nesta rodada
Gemini devolveu 429 (cota da conta) e OpenRouter tem um model ID inválido
("opemrouter") cadastrado -- nenhum dos dois é falha do código novo.

## Elemento visual
(seção só pra cumprir o piso de 6 blocos que o layout "insights" exige)

## Dado de impacto
0 chamadas de IA gastas neste teste -- Markdown escrito à mão.

## Lições aprendidas
O parser e o portão de publicação não dependem da origem do Markdown, só do
formato -- por isso dá pra validar o pipeline sem gastar cota de API.

## Ponte narrativa
Depois que a cota/config de IA for resolvida, o mesmo caminho vale pra
conteúdo gerado de verdade -- nenhuma mudança de código necessária.

## Call to action
Este arquivo pode ser removido com segurança -- é só um commit local, nunca
foi dado push.
