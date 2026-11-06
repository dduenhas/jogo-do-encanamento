# Jogo do Encanamento

Um quebra-cabeça de canos para a sala de aula. A água nasce em **S**, o aluno monta o caminho e ela precisa chegar ao ralo **R**. Da terceira fase em diante, a cisterna **C** também precisa encher. Qualquer ponta aberta vaza.

O jogo segue a gramática do *Pipe Mania*: uma fila de peças, rotação antes de colocar, colocação livre no tabuleiro e um fluido que percorre o que foi construído. São três estilos — vidro, bambu e futurista — com dez fases cada. Não há conta, ranking online nem arquivos de áudio: o som é sintetizado no navegador e o progresso fica no próprio aparelho.

Para jogar, abra o site. Para rodar na máquina, sirva a pasta (um `index.html` aberto direto também funciona):

```bash
python -m http.server 8765
```

As regras do tabuleiro podem ser conferidas sem navegador:

```bash
node test/engine.test.js
node test/levelgen.test.js
```

## Como se joga

A peça da frente da fila é a próxima. Ela gira e entra em qualquer casa vazia. Durante o preparo a água ainda não corre. No modo automático, ela sai sozinha quando o tempo acaba; soltá-la antes, pelo registro do tabuleiro ou pela tecla R, vale um bônus. No modo manual, o cronômetro não dispara o fluxo: a água só anda quando o aluno aciona o registro.

Cada peça tem uma função e não enfeita o tabuleiro:

- a reta segue;
- a curva muda de direção;
- a junção T divide o fluxo, um braço segue ao ralo e o outro alimenta a cisterna;
- a cruz atravessa dois caminhos e só funciona com os quatro braços ligados;
- o tanque substitui uma reta, enche devagar e vale mais pontos.

Uma boca sem par é derrota. A água então toma o tabuleiro inteiro, para o erro ficar visível. Se o fluido para sem alcançar todos os destinos, a fase também se perde. Vencer exige que S alcance cada destino sem vazamento. Uma estrela basta para concluir; a segunda pede soltar a água cedo, no modo automático; a terceira pede fazer isso sem descartar nem substituir peça.

O medidor à esquerda muda a velocidade do fluido na hora. Para cima, a água corre mais; para baixo, dá mais tempo de ler o caminho.

## Fundamentação

O jogo trata o encanamento como um problema de relação entre entrada e saída. S é a entrada, R e C são as saídas, e as peças são as transformações admitidas entre uma e outra. Essa formulação é antiga na computação — um problema bem posto diz o que entra, o que deve sair e quais operações são legais — e é também a forma mais honesta de um quebra-cabeça: a regra cabe numa frase e a dificuldade mora na combinação.

A fila impede a onisciência. O aluno não escolhe a peça ideal no catálogo; trabalha com a que chegou e com a decisão de guardá-la, girá-la, descartá-la ou cobrir um cano seco. Isso aproxima a atividade do planejamento sob restrição, não da montagem de um desenho já sabido. A solução oficial de cada fase existe e garante que o mapa é possível, mas o tabuleiro aceita outro caminho, desde que a água chegue inteira.

O tempo de preparo separa o projeto da consequência. Enquanto a água não corre, o aluno pode errar barato: substituir uma peça seca custa pontos, não a fase. Quando o fluido entra, a consequência fica contínua e visível dentro do cano. O acerto não é um aviso. É a água atravessando o que foi construído. O erro também não é um aviso. É o vazamento e, em seguida, o alagamento.

A progressão das trinta fases é uma escada de ideias, não só de tamanho:

1. retas e curvas, um ralo, e um obstáculo fechando o “seguir em frente” de cada curva;
2. a junção T passa a ser necessária, porque existe uma cisterna além do ralo;
3. a cruz passa a ser necessária, porque o ramal atravessa o corredor;
4. o tanque entra como escolha de pontuação, não como peça obrigatória da topologia.

O aluno encontra a peça nova quando o mapa já tornou a peça antiga insuficiente. Retirá-la seria mais claro do que deixá-la sem função.

## Escolhas estéticas

Há três matérias, e cada uma muda o que significa “ver a água”.

**Vidro.** O cano é uma janela. O miolo é oco, a parede é clara, a água é azul-cobalto com filete ciano para não se perder no azulejo. Anéis cromados marcam a junta sem tapar o canal. O registro é uma roda circular, o gesto de quem abre uma válvula de laboratório. O som é água corrente e um estalo de vidro. A ideia visual é a da transparência: o aluno deve ver o fluido passar por dentro da peça, não apenas na emenda.

**Bambu.** O cano ainda é vivo. Pedra, musgo, corda de sisal, nó e folha. O líquido é seiva, verde e amarelo, grosso, com bolha. A alavanca é um galho amarrado. O som é madeira e gotejo. A técnica aqui não parece máquina; parece cultivo. O caminho continua sendo lógica, mas o mundo ao redor lembra que conduzir um fluxo também é cuidar de um material.

**Futurista.** O cano anuncia a própria energia. Fibra escura, abraçadeira metálica, plasma laranja e violeta, botoneira neon. O som é elétrico. O futuro, neste jogo, não é um cenário de cidade. É um material que brilha quando a conexão está certa e denuncia a ponta aberta com a mesma intensidade.

Nos três estilos o canal ficou oco de propósito. Um cano opaco escondia a única informação que importa durante o fluxo: por onde a água está indo. O fluido ocupa o miolo; a parede, a corda ou a abraçadeira ficam na borda, como moldura, não como tampa.

O tabuleiro é escuro para o cano e a água serem a figura. O painel é curto. O registro, a alavanca ou a botoneira nascem numa casa que não é S, não é destino e não faz parte do caminho da solução, para o controle não roubar a peça que o aluno precisa colocar.

Quando a fase acaba bem, o quadro de “próxima fase” espera. A água termina de encher e o aluno olha o encanamento pronto. A pressa do sistema escolar — fechar, pontuar, avançar — foi adiada de propósito por alguns segundos.

## Escolhas filosóficas

O jogo aposta que uma regra pequena, estável e visível ensina mais do que um tutorial longo. A frase cabe no cartaz: a água sai de S e tem de chegar ao destino, sem ponta aberta. Todo o resto é consequência dessa frase.

Errar faz parte do objeto, não da punição escondida. Substituir um cano seco é permitido e tem preço. Vazar alaga o mapa, com um som que desce de tom, para o fracasso ser percebido pelo corpo antes de ser lido num quadro. A derrota não apaga o tabuleiro na hora. Primeiro mostra o que a água fez com o plano.

O aluno também escolhe o regime da consequência. No automático, o mundo tem prazo: a água vem, queira o plano pronto ou não. No manual, o prazo deixa de ser o maestro e o gesto do registro passa a ser a autoria. Os dois modos são legítimos. O automático treina decidir sob tempo. O manual treina decidir quando o plano está à altura. Nenhum dos dois é tratado como o modo “sério”.

A velocidade é um medidor, não um menu de dificuldade com nomes morais. Mais rápida não significa aluno melhor. Significa menos tempo para corrigir depois que a água entrou. O professor, ou o próprio aluno, nivela o fluxo ao momento da aula.

O jogo não coleta o aluno. Não há servidor de partida, não há nome obrigatório, não há peça comprada. O recorde mora no navegador. Isso é uma escolha sobre infância e dado: a atividade pode acontecer na escola sem abrir uma conta.

O som não vem de arquivo. Cada estilo tem uma voz feita de ruído, tom e filtro, para o material ser ouvido junto com o que é visto. Vidro corre, bambu goteja, o futuro zumbe. Quando a água vaza, essa voz é interrompida por um intervalo descendente e dissonante. O ouvido entende a derrota mesmo se o olhar ainda está no cano.

## Alinhamento com a BNCC e com a Computação

A Base Nacional Comum Curricular de 2018 não tem um componente chamado Tecnologia. O que a escola costuma nomear assim atravessa as competências gerais e, desde 2022, o complemento de Computação. Este jogo se encosta nos dois, sem fingir que uma partida cumpre sozinha uma habilidade.

A competência geral 5 pede compreender, usar e criar tecnologias digitais de forma crítica, significativa, reflexiva e ética para resolver problemas e exercer autoria. A competência geral 2 pede exercitar a curiosidade intelectual e a investigação, elaborar e testar hipóteses. No tabuleiro, a hipótese é o cano; o teste é a água.

O complemento aprovado pelo Parecer CNE/CEB nº 2/2022 e instituído pela Resolução CNE/CEB nº 1/2022 organiza a Computação em três eixos: Pensamento Computacional, Mundo Digital e Cultura Digital. O jogo mora sobretudo no primeiro, conversa com o segundo pela forma como a informação é desenhada, e com o terceiro pela autoria e pelo uso responsável de um artefato simples.

| Habilidade | O que a norma pede | O que a fase pede ao aluno |
| --- | --- | --- |
| EF15CO01 | Identificar formas de organizar e representar a informação, entre elas matrizes, registros e listas. | Ler o tabuleiro como matriz, a fila como lista e cada casa como um registro: vazia, cano, bloqueio, fonte ou destino. |
| EF15CO02 | Construir e simular algoritmos com sequências de instruções. | Ordenar peças e giros até que a água, ao simular o caminho, percorra a sequência montada. |
| EF15CO04 | Decompor um problema complexo, resolver as partes e combiná-las. | Separar o trecho até o ralo do ramal da cisterna e só então unir os dois numa T ou numa cruz. |
| EF69CO04 | Construir soluções por decomposição. | Nas fases avançadas, o corredor, o ramal e o cruzamento são subproblemas com peças diferentes. |
| EF69CO05 | Identificar entradas e saídas e tratar o problema como relação entre elas. | S é entrada. R e C são saídas. A peça só vale se transforma a primeira nas segundas sem perder fluxo. |
| EF69CO06 | Comparar instâncias de um mesmo problema e reconhecer o que permanece. | As trinta fases repetem a mesma relação entrada-saída e mudam tamanho, voltas, ramais e prazo. |
| EF01CO02 e EF01CO03 | Identificar, seguir, reorganizar e criar sequências de passos. | Nos anos iniciais, girar e encaixar já é uma sequência curta, com resultado visível. |
| EF15CO08 e EF01CO06 | Usar artefatos computacionais para resolver problemas e atender uma necessidade. | O jogo é o artefato: cabe no navegador da escola e serve a uma situação de aula, não a um aplicativo paralelo. |

O eixo Mundo Digital aparece na codificação visível. Direção, máscara de bocas e estado da casa são informações codificadas, e o desenho as devolve ao aluno sem pedir que ele leia código. Ver o fluido dentro do cano é a decodificação: o estado interno do sistema ficou público.

O eixo Cultura Digital aparece no modo de uso. O aluno escolhe ritmo e autoria (automático ou manual), joga sem ceder dados e encontra três imaginários de técnica — o laboratório transparente, o material que cresce, a máquina que se anuncia. Dá para perguntar em aula qual desses mundos trata a água como recurso, qual trata como seiva e qual trata como energia, e o que muda no cuidado quando o nome do fluido muda.

O jogo não avalia a habilidade no lugar do professor. A estrela registra uma partida, não uma aprendizagem. O alinhamento serve para o planejamento: dizer em que eixo a aula está e o que observar enquanto a água corre. Observar, por exemplo, se o aluno antecipa a boca aberta, se separa o ramal do corredor, se revisa um cano seco antes do fluxo ou só reage ao vazamento.

Uma aula curta pode ser: uma fase no automático, a conversa sobre onde a água vazaria, a mesma fase no manual com o medidor mais lento, e o registro escrito de uma estratégia (“primeiro o caminho do R, depois o da C”). Isso cabe em EF15CO02 e EF15CO04 sem transformar o jogo em ficha.

## Preparado para a Vercel

O projeto é estático. Não há instalador, não há empacotador e não há etapa de build. A Vercel publica a raiz do repositório. O arquivo `vercel.json` deixa isso explícito: framework nenhum, comando de build vazio, pasta de saída na raiz.

Na Vercel:

1. **Add New… → Project** e importe `dduenhas/jogo-do-encanamento`.
2. Framework Preset: **Other**.
3. Build Command vazio. Output Directory: `.` ou vazio, conforme o painel oferecer a raiz.
4. Deploy.

O endereço gerado abre direto no `index.html`. Não é preciso variável de ambiente.

## Código

HTML, CSS e JavaScript sem dependências. Cada arquivo em `js/` é um módulo imediato pendurado em `window.PM`: peças, configuração, gerador de fases, fluido, desenho, regras, entrada, interface e o laço principal. `test/` carrega só o necessário no Node e confere colocação, vazamento, vitória nas trinta fases e a validade dos mapas gerados.

A fonte permanece na primeira linha, abrindo para o sul. As fases são determinísticas a partir do estilo e do número: o mesmo aluno, no mesmo aparelho ou em outro, encontra o mesmo mapa.
