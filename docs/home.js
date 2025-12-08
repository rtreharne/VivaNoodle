document.addEventListener("DOMContentLoaded", () => {
    const timerEl = document.querySelector("[data-hero-timer]");
    const chatEl = document.querySelector("[data-hero-chat]");
    const inputEl = document.querySelector("[data-hero-input]");
    const sendBtn = document.querySelector("[data-hero-send]");
    const loaderRow = document.querySelector("[data-hero-loader]");
    const topicEl = document.querySelector("[data-hero-topic]");
    const playBtn = document.querySelector("[data-hero-play]");
    const nextBtn = document.querySelector("[data-hero-next]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navLinks = document.querySelector("[data-nav-links]");
    const heroPanel = document.querySelector(".hero-panel");
    const langSelect = document.querySelector("[data-lang-select]");

    if (!timerEl || !chatEl || !inputEl || !sendBtn || !loaderRow || !heroPanel || !topicEl || !playBtn || !nextBtn) return;

    let currentLanguage = "en";

    const scenarios = [
        {
            title: "R EDA (Biology)",
            script: [
                { sender: "ai", text: "You were asked to run an exploratory analysis on a gene expression dataset. Walk me through how you loaded the CSV and checked for missing values." },
                { sender: "user", text: "I used readr::read_csv with col_types to set gene cols, then colSums(is.na(df)) to spot gaps." },
                { sender: "ai", text: "Look at this snippet:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nWhat does it tell you, and what’s missing for reliability?" },
                { sender: "user", text: "It compares mean expression by condition but lacks spread and n; we need sd/ci and counts." },
                { sender: "ai", text: "You also ran:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nHow would you interpret outliers and possible batch effects?" },
                { sender: "user", text: "Outliers could be real extremes or artifacts; if a batch aligns with them, that suggests batch effects." },
                { sender: "ai", text: "What simple normalisation or transform would you try before plotting, and why?" },
                { sender: "user", text: "Use log1p(expr) to reduce skew and stabilise variance before group comparisons." },
            ],
            feedback: "Thanks for finishing the viva. Feedback: Strengths — good EDA hygiene in R (readr typing, NA checks) and awareness of spread and batch effects. Improve — always report n and variability, add distribution checks (hist/density), and note any batch adjustment. Include code to log-transform before plotting. Overall — solid EDA mindset; add robustness and transparency."
        },
        {
            title: "Python ML (Classification)",
            script: [
                { sender: "ai", text: "You trained a classifier on a biological outcomes dataset. How did you split the data and why?" },
                { sender: "user", text: "Used train_test_split with stratify on the label to preserve class balance; 70/30 split." },
                { sender: "ai", text: "Consider this code:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nWhat does the pipeline buy you?" },
                { sender: "user", text: "It keeps preprocessing tied to the model and avoids leakage by fitting imputer/scaler only on train folds." },
                { sender: "ai", text: "You reported accuracy. What else would you show, and why?" },
                { sender: "user", text: "Precision/recall/F1 and a confusion matrix to see class balance; maybe AUC if thresholding matters." },
                { sender: "ai", text: "Your validation curve shows train=0.99, val=0.78. What’s your next move?" },
                { sender: "user", text: "Likely overfitting; reduce model complexity or add regularisation/feature selection; check data leakage." },
            ],
            feedback: "Thanks for finishing the viva. Feedback: Strengths — good on stratified splits, leakage prevention with pipelines, and richer metrics beyond accuracy. Improve — show calibration/threshold choice, justify regularisation values, and report cross-val variance. Overall — solid ML hygiene; add interpretability and robustness checks."
        },
        {
            title: "Climate Resilience",
            script: [
                { sender: "ai", text: "In your submission you argue that rewilding stabilises local ecosystems. Which mechanisms make that resilience possible?" },
                { sender: "user", text: "Predators reset trophic cascades, which lets vegetation recover and boosts biodiversity." },
                { sender: "ai", text: "Push deeper: how does vegetation recovery translate into resilience during droughts?" },
                { sender: "user", text: "More root mass and canopy cover keep moisture in soil, so shock events do less damage." },
                { sender: "ai", text: "Great. What’s the strongest counter-argument in densely populated regions?" },
                { sender: "user", text: "Land-use conflict with existing agriculture; without incentives, farmers will block rewilding." },
                { sender: "ai", text: "If you could change one policy lever to address that, what would it be?" },
                { sender: "user", text: "Tiered subsidies tied to biodiversity metrics, plus guarantees that livestock corridors stay open." },
            ],
            feedback: "Thanks for finishing the viva. Feedback: Strengths — clear on trophic cascades and how they stabilise ecosystems; you tied mechanisms to resilience. Improve — sharpen the urban counter-argument with a specific risk scenario and data; propose one policy lever with trade-offs (e.g., tiered subsidies vs. land access). Overall — solid grasp of mechanisms; increase specificity and anticipate objections earlier."
        },
        {
            title: "Microeconomics",
            script: [
                { sender: "ai", text: "You modelled a price ceiling in a competitive market. What happens to consumer surplus in your scenario?" },
                { sender: "user", text: "It rises for the consumers who can still buy, but overall surplus falls because of deadweight loss." },
                { sender: "ai", text: "How would elasticity of supply change the magnitude of that deadweight loss?" },
                { sender: "user", text: "More elastic supply means a bigger quantity drop, so the deadweight loss increases." },
                { sender: "ai", text: "What non-price rationing mechanism would most likely emerge?" },
                { sender: "user", text: "Queuing or side payments; in housing, it could be key money or time-based queues." },
                { sender: "ai", text: "Name one policy alternative that avoids that loss but keeps affordability in view." },
                { sender: "user", text: "Targeted housing vouchers or wage subsidies address affordability without distorting supply." },
            ],
            feedback: "Feedback: Strengths — solid intuition on surplus shifts and elasticity effects; you connected theory to practical rationing. Improve — quantify the elasticity scenario and show the deadweight loss change; contrast at least two affordability tools with pros/cons. Overall — good grasp of welfare impacts; add numbers to strengthen the argument."
        },
        {
            title: "Modern Literature",
            script: [
                { sender: "ai", text: "You argue the narrator is unreliable. Which textual signals support that claim?" },
                { sender: "user", text: "They contradict themselves about the timeline and misreport what other characters say." },
                { sender: "ai", text: "How does that unreliability shape the reader’s trust by the midpoint?" },
                { sender: "user", text: "We start doubting every new detail and read more critically, looking for corroboration." },
                { sender: "ai", text: "Connect this to a broader modernist technique." },
                { sender: "user", text: "It mirrors stream-of-consciousness fragmentation, forcing readers to assemble meaning." },
                { sender: "ai", text: "Which passage best illustrates that fragmentation?" },
                { sender: "user", text: "The train scene, where interior monologue and external events blur without clear markers." },
            ],
            feedback: "Feedback: Strengths — identified key unreliability cues and linked them to modernist technique; good close reading. Improve — cite one more passage and explain how structure (syntax/pacing) enforces uncertainty. Overall — strong interpretive stance; deepen evidence density."
        },
        {
            title: "Human Physiology",
            script: [
                { sender: "ai", text: "You claim the patient’s fatigue is primarily endocrine in origin. Which lab markers support that?" },
                { sender: "user", text: "Low TSH with elevated T4 points to hyperthyroidism; heart rate and weight loss match." },
                { sender: "ai", text: "What differential are you ruling out, and how?" },
                { sender: "user", text: "Ruling out anemia due to normal Hb and ferritin; cortisol is normal so less likely adrenal." },
                { sender: "ai", text: "How would you stage next diagnostics?" },
                { sender: "user", text: "Thyroid uptake scan plus antibody test to distinguish Graves from toxic nodules." },
                { sender: "ai", text: "What lifestyle advice would you add while awaiting results?" },
                { sender: "user", text: "Avoid high caffeine, monitor heart rate, and ensure adequate calories to counter weight loss." },
            ],
            feedback: "Feedback: Strengths — clear differential reasoning and lab interpretation; appropriate next diagnostics. Improve — mention cardiac risks and a plan for symptom control; flag when to escalate. Overall — clinically sound; add patient safety cues."
        },
        {
            title: "Software Architecture",
            script: [
                { sender: "ai", text: "You chose an event-driven architecture. Which coupling risks did you mitigate?" },
                { sender: "user", text: "We enforced contract schemas and idempotent consumers to avoid hidden coupling." },
                { sender: "ai", text: "How did you handle eventual consistency for user-facing flows?" },
                { sender: "user", text: "We used read models with optimistic UI and retries; critical writes have compensating actions." },
                { sender: "ai", text: "Name one place you would still consider a synchronous call." },
                { sender: "user", text: "For payment authorization, where we need immediate confirmation before proceeding." },
                { sender: "ai", text: "What metric would tell you the system is degrading under load?" },
                { sender: "user", text: "Spike in DLQ volume and consumer lag; also latency on the read models." },
            ],
            feedback: "Feedback: Strengths — good on contract discipline, idempotency, and compensating actions. Improve — specify backpressure strategy and SLOs; clarify when sync fallback is acceptable. Overall — solid architectural reasoning; add observability thresholds."
        },
        {
            title: "Urban Design",
            script: [
                { sender: "ai", text: "You propose a 15-minute city model. What equity risks did you identify?" },
                { sender: "user", text: "Gentrification and displacement if amenities drive rents up; service gaps in underserved zones." },
                { sender: "ai", text: "How would you measure whether access is truly equitable?" },
                { sender: "user", text: "Travel-time isochrones by income bracket and mobility mode; compare amenity counts per capita." },
                { sender: "ai", text: "What governance mechanism keeps those metrics transparent?" },
                { sender: "user", text: "Open data dashboards with quarterly audits; community boards review changes." },
                { sender: "ai", text: "Give one mitigation for displacement risk." },
                { sender: "user", text: "Inclusionary zoning plus rent stabilization near new amenity clusters." },
            ],
            feedback: "Feedback: Strengths — clear on equity metrics and governance transparency; identified displacement risk. Improve — quantify targets for access gaps and outline funding for mitigations. Overall — strong civic framing; add numbers and timelines."
        },
    ];

    let countdownInterval = null;
    let loopTimeouts = [];
    let endTriggered = false;
    let submitted = false;
    let firstRun = true;
    let paused = false;
    let countdownRemaining = 60;
    let currentScenario = null;

    const formatTime = (seconds) => {
        const m = String(Math.floor(seconds / 60)).padStart(2, "0");
        const s = String(seconds % 60).padStart(2, "0");
        return `${m}:${s}`;
    };

    const schedule = (fn, delay) => {
        const handle = { active: true, timeoutId: null };
        const target = Date.now() + delay;

        const tick = () => {
            if (!handle.active) return;
            if (paused) {
                handle.timeoutId = setTimeout(tick, 120);
                return;
            }
            const remaining = target - Date.now();
            if (remaining <= 0) {
                fn();
            } else {
                handle.timeoutId = setTimeout(tick, Math.min(remaining, 150));
            }
        };

        handle.timeoutId = setTimeout(tick, Math.min(delay, 150));
        loopTimeouts.push(handle);
        return handle;
    };

    const clearTimeline = () => {
        loopTimeouts.forEach((handle) => {
            if (handle && handle.timeoutId) {
                handle.active = false;
                clearTimeout(handle.timeoutId);
            }
        });
        loopTimeouts = [];
        clearInterval(countdownInterval);
        countdownInterval = null;
    };

    const translations = {
        es: {
            "You were asked to run an exploratory analysis on a gene expression dataset. Walk me through how you loaded the CSV and checked for missing values.": "Se te pidió un análisis exploratorio de un conjunto de expresión génica. Explícame cómo cargaste el CSV y revisaste valores faltantes.",
            "I used readr::read_csv with col_types to set gene cols, then colSums(is.na(df)) to spot gaps.": "Usé readr::read_csv con col_types para los genes y luego colSums(is.na(df)) para detectar vacíos.",
            "Look at this snippet:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nWhat does it tell you, and what’s missing for reliability?": "Mira este fragmento:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\n¿Qué te dice y qué falta para fiabilidad?",
            "It compares mean expression by condition but lacks spread and n; we need sd/ci and counts.": "Compara medias por condición pero falta dispersión y n; necesitamos sd/ci y conteos.",
            "You also ran:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nHow would you interpret outliers and possible batch effects?": "También ejecutaste:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\n¿Cómo interpretas outliers y posibles efectos de lote?",
            "Outliers could be real extremes or artifacts; if a batch aligns with them, that suggests batch effects.": "Los outliers pueden ser extremos reales o artefactos; si un lote coincide, sugiere efectos de lote.",
            "What simple normalisation or transform would you try before plotting, and why?": "¿Qué normalización o transformación simple probarías antes de graficar y por qué?",
            "Use log1p(expr) to reduce skew and stabilise variance before group comparisons.": "Usaría log1p(expr) para reducir sesgo y estabilizar varianza antes de comparar grupos.",

            "You trained a classifier on a biological outcomes dataset. How did you split the data and why?": "Entrenaste un clasificador con datos biológicos. ¿Cómo dividiste los datos y por qué?",
            "Used train_test_split with stratify on the label to preserve class balance; 70/30 split.": "Usé train_test_split con estratificación en la etiqueta para preservar balance; división 70/30.",
            "Consider this code:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nWhat does the pipeline buy you?": "Considera este código:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\n¿Qué aporta el pipeline?",
            "It keeps preprocessing tied to the model and avoids leakage by fitting imputer/scaler only on train folds.": "Mantiene el preprocesamiento ligado al modelo y evita fugas al ajustar imputador/escalador solo en train.",
            "You reported accuracy. What else would you show, and why?": "Reportaste accuracy. ¿Qué más mostrarías y por qué?",
            "Precision/recall/F1 and a confusion matrix to see class balance; maybe AUC if thresholding matters.": "Precisión/recall/F1 y matriz de confusión para ver balance; quizá AUC si importa el umbral.",
            "Your validation curve shows train=0.99, val=0.78. What’s your next move?": "Curva de validación: train=0.99, val=0.78. ¿Próximo paso?",
            "Likely overfitting; reduce model complexity or add regularisation/feature selection; check data leakage.": "Probable sobreajuste; reduce complejidad o añade regularización/selección de variables; revisa fugas.",

            "In your submission you argue that rewilding stabilises local ecosystems. Which mechanisms make that resilience possible?": "En tu entrega dices que la re-silvestración estabiliza ecosistemas locales. ¿Qué mecanismos permiten esa resiliencia?",
            "Predators reset trophic cascades, which lets vegetation recover and boosts biodiversity.": "Los depredadores restablecen cascadas tróficas, lo que permite la recuperación de vegetación y aumenta biodiversidad.",
            "Push deeper: how does vegetation recovery translate into resilience during droughts?": "Profundiza: ¿cómo se traduce la recuperación de vegetación en resiliencia ante sequías?",
            "More root mass and canopy cover keep moisture in soil, so shock events do less damage.": "Más biomasa radicular y dosel retienen humedad, así los choques causan menos daño.",
            "Great. What’s the strongest counter-argument in densely populated regions?": "Bien. ¿Cuál es el contraargumento más fuerte en zonas densamente pobladas?",
            "Land-use conflict with existing agriculture; without incentives, farmers will block rewilding.": "Conflicto de uso de suelo con agricultura; sin incentivos, los agricultores bloquearán la re-silvestración.",
            "If you could change one policy lever to address that, what would it be?": "Si cambiaras una palanca de política para eso, ¿cuál sería?",
            "Tiered subsidies tied to biodiversity metrics, plus guarantees that livestock corridors stay open.": "Subsidios escalonados ligados a métricas de biodiversidad y garantías de corredores para ganado.",

            "Thanks for finishing the viva. Feedback: Strengths — good EDA hygiene in R (readr typing, NA checks) and awareness of spread and batch effects. Improve — always report n and variability, add distribution checks (hist/density), and note any batch adjustment. Include code to log-transform before plotting. Overall — solid EDA mindset; add robustness and transparency.": "Gracias por completar la viva. Comentarios: Fortalezas — buena higiene de EDA en R (tipado con readr, revisión de NA) y atención a dispersión y efectos de lote. Mejora — siempre reporta n y variabilidad, añade chequeos de distribución (hist/densidad) y anota cualquier ajuste de lote. Incluye código para log-transformar antes de graficar. En conjunto — mentalidad EDA sólida; añade robustez y transparencia.",
            "Thanks for finishing the viva. Feedback: Strengths — good on stratified splits, leakage prevention with pipelines, and richer metrics beyond accuracy. Improve — show calibration/threshold choice, justify regularisation values, and report cross-val variance. Overall — solid ML hygiene; add interpretability and robustness checks.": "Gracias por terminar la viva. Comentarios: Fortalezas — buen uso de splits estratificados, prevención de fugas con pipelines y métricas más ricas que la accuracy. Mejora — muestra calibración/elección de umbral, justifica valores de regularización y reporta varianza en cross-val. En conjunto — buena higiene de ML; añade interpretabilidad y pruebas de robustez.",
            "Thanks for finishing the viva. Feedback: Strengths — clear on trophic cascades and how they stabilise ecosystems; you tied mechanisms to resilience. Improve — sharpen the urban counter-argument with a specific risk scenario and data; propose one policy lever with trade-offs (e.g., tiered subsidies vs. land access). Overall — solid grasp of mechanisms; increase specificity and anticipate objections earlier.": "Gracias por finalizar la viva. Comentarios: Fortalezas — claridad sobre cascadas tróficas y cómo estabilizan ecosistemas; conectaste mecanismos con resiliencia. Mejora — afina el contraargumento urbano con un escenario de riesgo y datos; propone una palanca de política con trade-offs (p. ej., subsidios escalonados vs. acceso a tierras). En conjunto — buen dominio de mecanismos; añade más especificidad y anticipa objeciones antes."
        },
        fr: {
            "You were asked to run an exploratory analysis on a gene expression dataset. Walk me through how you loaded the CSV and checked for missing values.": "On t’a demandé une analyse exploratoire d’un jeu d’expression génique. Explique comment tu as chargé le CSV et vérifié les valeurs manquantes.",
            "I used readr::read_csv with col_types to set gene cols, then colSums(is.na(df)) to spot gaps.": "J’ai utilisé readr::read_csv avec col_types pour les colonnes de gènes, puis colSums(is.na(df)) pour repérer les manques.",
            "Look at this snippet:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nWhat does it tell you, and what’s missing for reliability?": "Regarde cet extrait:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nQu’indique-t-il et que manque-t-il pour la fiabilité?",
            "It compares mean expression by condition but lacks spread and n; we need sd/ci and counts.": "Il compare les moyennes par condition mais sans dispersion ni n; il faut sd/ci et les effectifs.",
            "You also ran:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nHow would you interpret outliers and possible batch effects?": "Tu as aussi exécuté:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nComment interprètes-tu les outliers et d’éventuels effets de lot?",
            "Outliers could be real extremes or artifacts; if a batch aligns with them, that suggests batch effects.": "Les outliers peuvent être des extrêmes réels ou des artefacts; si un lot s’aligne, cela suggère un effet de lot.",
            "What simple normalisation or transform would you try before plotting, and why?": "Quelle normalisation ou transformation simple essaierais-tu avant de tracer, et pourquoi?",
            "Use log1p(expr) to reduce skew and stabilise variance before group comparisons.": "Utilise log1p(expr) pour réduire l’asymétrie et stabiliser la variance avant les comparaisons.",

            "You trained a classifier on a biological outcomes dataset. How did you split the data and why?": "Tu as entraîné un classifieur sur des données biologiques. Comment as-tu découpé les données et pourquoi ?",
            "Used train_test_split with stratify on the label to preserve class balance; 70/30 split.": "Découpage train_test_split avec stratification sur le label pour garder l’équilibre; 70/30.",
            "Consider this code:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nWhat does the pipeline buy you?": "Considère ce code:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nQu’apporte le pipeline ?",
            "It keeps preprocessing tied to the model and avoids leakage by fitting imputer/scaler only on train folds.": "Il lie le prétraitement au modèle et évite les fuites en ajustant imputer/scaler seulement sur le train.",
            "You reported accuracy. What else would you show, and why?": "Tu as reporté l’accuracy. Que montrerais-tu d’autre et pourquoi ?",
            "Precision/recall/F1 and a confusion matrix to see class balance; maybe AUC if thresholding matters.": "Précision/rappel/F1 et matrice de confusion pour voir le balance; peut-être AUC si le seuil compte.",
            "Your validation curve shows train=0.99, val=0.78. What’s your next move?": "Courbe de validation : train=0.99, val=0.78. Prochaine étape ?",
            "Likely overfitting; reduce model complexity or add regularisation/feature selection; check data leakage.": "Probable surapprentissage; réduis la complexité ou ajoute régularisation/sélection de variables; vérifie les fuites.",

            "In your submission you argue that rewilding stabilises local ecosystems. Which mechanisms make that resilience possible?": "Tu soutiens que le réensauvagement stabilise les écosystèmes locaux. Quels mécanismes rendent cette résilience possible ?",
            "Predators reset trophic cascades, which lets vegetation recover and boosts biodiversity.": "Les prédateurs rétablissent les cascades trophiques, permettant à la végétation de se régénérer et d’augmenter la biodiversité.",
            "Push deeper: how does vegetation recovery translate into resilience during droughts?": "Plus loin : comment la régénération végétale se traduit-elle en résilience pendant les sécheresses ?",
            "More root mass and canopy cover keep moisture in soil, so shock events do less damage.": "Plus de racines et de couvert retiennent l’humidité, réduisant les dégâts des chocs.",
            "Great. What’s the strongest counter-argument in densely populated regions?": "Bien. Quel est le contre-argument le plus fort en zones denses ?",
            "Land-use conflict with existing agriculture; without incentives, farmers will block rewilding.": "Conflit d’usage du sol avec l’agriculture; sans incitations, les agriculteurs bloqueront le réensauvagement.",
            "If you could change one policy lever to address that, what would it be?": "Si tu changeais un levier de politique, lequel ?",
            "Tiered subsidies tied to biodiversity metrics, plus guarantees that livestock corridors stay open.": "Subventions graduées liées aux métriques de biodiversité, plus garanties de corridors pour le bétail.",

            "Thanks for finishing the viva. Feedback: Strengths — good EDA hygiene in R (readr typing, NA checks) and awareness of spread and batch effects. Improve — always report n and variability, add distribution checks (hist/density), and note any batch adjustment. Include code to log-transform before plotting. Overall — solid EDA mindset; add robustness and transparency.": "Merci d’avoir terminé la viva. Retour : Atouts — bonne hygiène EDA en R (typage readr, vérif des NA) et conscience de la dispersion et des effets de lot. À améliorer — toujours rapporter n et variabilité, ajouter des vérifs de distribution (hist/densité) et noter tout ajustement de lot. Inclure du code de log-transformation avant le tracé. Globalement — bonne posture EDA ; ajoute robustesse et transparence.",
            "Thanks for finishing the viva. Feedback: Strengths — good on stratified splits, leakage prevention with pipelines, and richer metrics beyond accuracy. Improve — show calibration/threshold choice, justify regularisation values, and report cross-val variance. Overall — solid ML hygiene; add interpretability and robustness checks.": "Merci d’avoir terminé la viva. Retour : Atouts — bons splits stratifiés, prévention des fuites avec pipelines, et métriques plus riches que l’accuracy. À améliorer — montrer la calibration/choix de seuil, justifier les valeurs de régularisation et reporter la variance en cross-val. Globalement — bonne hygiène ML ; ajoute interprétabilité et contrôles de robustesse.",
            "Thanks for finishing the viva. Feedback: Strengths — clear on trophic cascades and how they stabilise ecosystems; you tied mechanisms to resilience. Improve — sharpen the urban counter-argument with a specific risk scenario and data; propose one policy lever with trade-offs (e.g., tiered subsidies vs. land access). Overall — solid grasp of mechanisms; increase specificity and anticipate objections earlier.": "Merci d’avoir terminé la viva. Retour : Atouts — clair sur les cascades trophiques et leur rôle stabilisateur ; tu as relié mécanismes et résilience. À améliorer — affiner le contre-argument urbain avec un scénario de risque et des données ; proposer un levier politique avec arbitrages (ex. subventions graduées vs accès au foncier). Globalement — bonne maîtrise des mécanismes ; ajoute de la spécificité et anticipe plus tôt les objections."
        },
        de: {
            "You were asked to run an exploratory analysis on a gene expression dataset. Walk me through how you loaded the CSV and checked for missing values.": "Du sollst eine explorative Analyse eines Genexpressions-Datensatzes machen. Erkläre, wie du die CSV geladen und fehlende Werte geprüft hast.",
            "I used readr::read_csv with col_types to set gene cols, then colSums(is.na(df)) to spot gaps.": "Ich habe readr::read_csv mit col_types für die Gen-Spalten genutzt und colSums(is.na(df)) für Lücken.",
            "Look at this snippet:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nWhat does it tell you, and what’s missing for reliability?": "Schau dir diesen Ausschnitt an:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nWas sagt er aus und was fehlt für Verlässlichkeit?",
            "It compares mean expression by condition but lacks spread and n; we need sd/ci and counts.": "Vergleicht Mittelwerte nach Condition, aber ohne Streuung und n; wir brauchen sd/ci und Zählungen.",
            "You also ran:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nHow would you interpret outliers and possible batch effects?": "Du hast auch ausgeführt:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nWie interpretierst du Ausreißer und mögliche Batch-Effekte?",
            "Outliers could be real extremes or artifacts; if a batch aligns with them, that suggests batch effects.": "Ausreißer können echte Extreme oder Artefakte sein; wenn ein Batch passt, deutet das auf Batch-Effekte hin.",
            "What simple normalisation or transform would you try before plotting, and why?": "Welche einfache Normalisierung/Transformation würdest du vor dem Plotten probieren und warum?",
            "Use log1p(expr) to reduce skew and stabilise variance before group comparisons.": "log1p(expr) nutzen, um Schiefe zu reduzieren und Varianz zu stabilisieren vor Gruppenvergleichen.",

            "You trained a classifier on a biological outcomes dataset. How did you split the data and why?": "Du hast einen Klassifikator auf biomedizinischen Daten trainiert. Wie hast du die Daten gesplittet und warum?",
            "Used train_test_split with stratify on the label to preserve class balance; 70/30 split.": "Mit train_test_split und Stratify auf dem Label für Klassenbalance; 70/30 Split.",
            "Consider this code:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nWhat does the pipeline buy you?": "Betrachte diesen Code:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nWas bringt dir die Pipeline?",
            "It keeps preprocessing tied to the model and avoids leakage by fitting imputer/scaler only on train folds.": "Bindet das Preprocessing an das Modell und vermeidet Leakage, da Imputer/Scaler nur auf Train gefittet werden.",
            "You reported accuracy. What else would you show, and why?": "Du hast Accuracy gemeldet. Was noch und warum?",
            "Precision/recall/F1 and a confusion matrix to see class balance; maybe AUC if thresholding matters.": "Precision/Recall/F1 und Confusion Matrix für Balance; evtl. AUC wenn Schwellen wichtig sind.",
            "Your validation curve shows train=0.99, val=0.78. What’s your next move?": "Validierungskurve: Train=0.99, Val=0.78. Nächster Schritt?",
            "Likely overfitting; reduce model complexity or add regularisation/feature selection; check data leakage.": "Vermutlich Overfitting; Komplexität reduzieren oder Regularisierung/Feature-Selection; auf Leakage prüfen.",

            "In your submission you argue that rewilding stabilises local ecosystems. Which mechanisms make that resilience possible?": "Du argumentierst, dass Wiederverwilderung lokale Ökosysteme stabilisiert. Welche Mechanismen ermöglichen das?",
            "Predators reset trophic cascades, which lets vegetation recover and boosts biodiversity.": "Prädatoren setzen trophische Kaskaden zurück, wodurch Vegetation sich erholt und Biodiversität steigt.",
            "Push deeper: how does vegetation recovery translate into resilience during droughts?": "Tiefer: Wie wird Vegetationserholung zu Resilienz bei Dürre?",
            "More root mass and canopy cover keep moisture in soil, so shock events do less damage.": "Mehr Wurzelmasse und Kronendach halten Feuchtigkeit, Schocks richten weniger Schaden an.",
            "Great. What’s the strongest counter-argument in densely populated regions?": "Gut. Was ist das stärkste Gegenargument in dicht besiedelten Regionen?",
            "Land-use conflict with existing agriculture; without incentives, farmers will block rewilding.": "Nutzungskonflikte mit Landwirtschaft; ohne Anreize blockieren Landwirte die Wiederverwilderung.",
            "If you could change one policy lever to address that, what would it be?": "Wenn du einen Polit-Hebel ändern könntest, welcher?",
            "Tiered subsidies tied to biodiversity metrics, plus guarantees that livestock corridors stay open.": "Stufen-Subventionen an Biodiversitätsmetriken plus Garantien für Vieh-Korridore.",

            "Thanks for finishing the viva. Feedback: Strengths — good EDA hygiene in R (readr typing, NA checks) and awareness of spread and batch effects. Improve — always report n and variability, add distribution checks (hist/density), and note any batch adjustment. Include code to log-transform before plotting. Overall — solid EDA mindset; add robustness and transparency.": "Danke fürs Beenden der Viva. Feedback: Stärken — gute EDA-Hygiene in R (readr-Typisierung, NA-Checks) und Bewusstsein für Streuung und Batch-Effekte. Verbesserungen — immer n und Variabilität berichten, Verteilungschecks (Hist/Dichte) ergänzen und Batch-Anpassungen nennen. Code für Log-Transformation vor dem Plotten einfügen. Insgesamt — solide EDA-Haltung; mehr Robustheit und Transparenz hinzufügen.",
            "Thanks for finishing the viva. Feedback: Strengths — good on stratified splits, leakage prevention with pipelines, and richer metrics beyond accuracy. Improve — show calibration/threshold choice, justify regularisation values, and report cross-val variance. Overall — solid ML hygiene; add interpretability and robustness checks.": "Danke fürs Abschließen der Viva. Feedback: Stärken — gute stratifizierte Splits, Leakage-Vermeidung mit Pipelines und reichere Metriken als Accuracy. Verbesserungen — Calibration/Threshold-Wahl zeigen, Regularisierungswerte begründen und Cross-Val-Varianz berichten. Insgesamt — solide ML-Hygiene; mehr Interpretierbarkeit und Robustheitschecks ergänzen.",
            "Thanks for finishing the viva. Feedback: Strengths — clear on trophic cascades and how they stabilise ecosystems; you tied mechanisms to resilience. Improve — sharpen the urban counter-argument with a specific risk scenario and data; propose one policy lever with trade-offs (e.g., tiered subsidies vs. land access). Overall — solid grasp of mechanisms; increase specificity and anticipate objections earlier.": "Danke fürs Beenden der Viva. Feedback: Stärken — klar zu trophischen Kaskaden und ihrer stabilisierenden Wirkung; du hast Mechanismen mit Resilienz verknüpft. Verbesserungen — das urbane Gegenargument mit einem konkreten Risikoszenario und Daten schärfen; einen politischen Hebel mit Trade-offs vorschlagen (z. B. gestufte Subventionen vs. Flächenzugang). Insgesamt — gutes Verständnis der Mechanismen; mehr Spezifik und frühere Antizipation von Einwänden."
        },
        zh: {
            "You were asked to run an exploratory analysis on a gene expression dataset. Walk me through how you loaded the CSV and checked for missing values.": "请说明你如何加载基因表达CSV并检查缺失值。",
            "I used readr::read_csv with col_types to set gene cols, then colSums(is.na(df)) to spot gaps.": "我用 readr::read_csv 设置基因列类型，然后用 colSums(is.na(df)) 找缺失。",
            "Look at this snippet:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nWhat does it tell you, and what’s missing for reliability?": "看看这段代码:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\n它说明了什么，还缺少哪些可靠性信息？",
            "It compares mean expression by condition but lacks spread and n; we need sd/ci and counts.": "按条件比较均值，但缺少离散度和样本量；需要sd/置信区间和计数。",
            "You also ran:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nHow would you interpret outliers and possible batch effects?": "你还运行了:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\n如何解释离群值和可能的批次效应？",
            "Outliers could be real extremes or artifacts; if a batch aligns with them, that suggests batch effects.": "离群值可能是真实极端或伪影；若与某批次对应，提示批次效应。",
            "What simple normalisation or transform would you try before plotting, and why?": "绘图前会尝试哪种简单归一化/变换？为何？",
            "Use log1p(expr) to reduce skew and stabilise variance before group comparisons.": "用 log1p(expr) 减少偏斜并稳定方差再做组间比较。",

            "You trained a classifier on a biological outcomes dataset. How did you split the data and why?": "你在生物数据上训练了分类器。如何切分数据，为什么？",
            "Used train_test_split with stratify on the label to preserve class balance; 70/30 split.": "用 train_test_split 并按标签分层以保持类别平衡；70/30 切分。",
            "Consider this code:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nWhat does the pipeline buy you?": "看看这段代码:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\n这个 pipeline 的作用是什么？",
            "It keeps preprocessing tied to the model and avoids leakage by fitting imputer/scaler only on train folds.": "让预处理与模型绑定，只在训练折上拟合填充/标准化，避免数据泄露。",
            "You reported accuracy. What else would you show, and why?": "你报告了准确率，还会展示什么，为什么？",
            "Precision/recall/F1 and a confusion matrix to see class balance; maybe AUC if thresholding matters.": "精确率/召回/F1 和混淆矩阵看类别平衡；若阈值重要，可加 AUC。",
            "Your validation curve shows train=0.99, val=0.78. What’s your next move?": "验证曲线：训练0.99，验证0.78。下一步？",
            "Likely overfitting; reduce model complexity or add regularisation/feature selection; check data leakage.": "可能过拟合；降模型复杂度或加正则/特征选择；检查数据泄露。",

            "In your submission you argue that rewilding stabilises local ecosystems. Which mechanisms make that resilience possible?": "你认为重野化能稳定本地生态。哪些机制支撑这种韧性？",
            "Predators reset trophic cascades, which lets vegetation recover and boosts biodiversity.": "捕食者重置营养级联，让植被恢复并提升生物多样性。",
            "Push deeper: how does vegetation recovery translate into resilience during droughts?": "再深入：植被恢复如何在干旱中转化为韧性？",
            "More root mass and canopy cover keep moisture in soil, so shock events do less damage.": "更多根系和树冠保水，冲击事件破坏更小。",
            "Great. What’s the strongest counter-argument in densely populated regions?": "很好。在人口稠密地区最强的反对意见是什么？",
            "Land-use conflict with existing agriculture; without incentives, farmers will block rewilding.": "与农业用地冲突；没有激励，农民会阻止重野化。",
            "If you could change one policy lever to address that, what would it be?": "如果改一个政策杠杆来解决，它是什么？",
            "Tiered subsidies tied to biodiversity metrics, plus guarantees that livestock corridors stay open.": "与生物多样性指标挂钩的分级补贴，并确保牲畜通道开放。",

            "Thanks for finishing the viva. Feedback: Strengths — good EDA hygiene in R (readr typing, NA checks) and awareness of spread and batch effects. Improve — always report n and variability, add distribution checks (hist/density), and note any batch adjustment. Include code to log-transform before plotting. Overall — solid EDA mindset; add robustness and transparency.": "感谢完成答辩。反馈：优势 — 在 R 中保持良好的 EDA 习惯（readr 类型、NA 检查），关注离散度和批次效应。改进 — 始终报告 n 和波动，补充分布检查（直方/密度），说明任何批次调整。作图前加入对数变换代码。整体 — EDA 思维扎实；再加强稳健性和透明度。",
            "Thanks for finishing the viva. Feedback: Strengths — good on stratified splits, leakage prevention with pipelines, and richer metrics beyond accuracy. Improve — show calibration/threshold choice, justify regularisation values, and report cross-val variance. Overall — solid ML hygiene; add interpretability and robustness checks.": "感谢完成答辩。反馈：优势 — 分层切分、用 pipeline 防止泄露、指标不限于准确率。改进 — 展示校准/阈值选择，说明正则化取值，并报告交叉验证方差。整体 — ML 卫生良好；补充可解释性与稳健性检查。",
            "Thanks for finishing the viva. Feedback: Strengths — clear on trophic cascades and how they stabilise ecosystems; you tied mechanisms to resilience. Improve — sharpen the urban counter-argument with a specific risk scenario and data; propose one policy lever with trade-offs (e.g., tiered subsidies vs. land access). Overall — solid grasp of mechanisms; increase specificity and anticipate objections earlier.": "感谢完成答辩。反馈：优势 — 清楚阐述营养级联如何稳定生态，把机制与韧性联系起来。改进 — 用具体城市风险情景和数据强化反对观点；提出一个带权衡的政策杠杆（如分级补贴 vs. 土地获取）。整体 — 对机制掌握扎实；提高具体性，提前预判异议。"
        },
        ar: {
            "You were asked to run an exploratory analysis on a gene expression dataset. Walk me through how you loaded the CSV and checked for missing values.": "dim jfua HMA lidaa tahlil istikshafi limjmue dati tabir aljinat. sharh kayfa hamalt malaf CSV watahqqaqt min alqiam almafqouda.",
            "I used readr::read_csv with col_types to set gene cols, then colSums(is.na(df)) to spot gaps.": "istakhdamt readr::read_csv mae col_types litahdid aamad alajin, thumma colSums(is.na(df)) likashf alfuragh.",
            "Look at this snippet:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nWhat does it tell you, and what’s missing for reliability?": "anzur ila hadha almaqtae:\n\n```\ndf %>% group_by(condition) %>% summarise(mean_expr = mean(expr, na.rm = TRUE))\n```\n\nmadha yubayyin, wamatha yanfasu lilthiqa?",
            "It compares mean expression by condition but lacks spread and n; we need sd/ci and counts.": "yuqarin mutawasit altabir hasaba alhala, lakin bidun inhiraf ean almaeyan wala eadad; nahtaj sd/ci waleadad.",
            "You also ran:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nHow would you interpret outliers and possible batch effects?": "kadhalk shghalt:\n\n```\nggplot(df, aes(condition, expr, fill = sex)) + geom_boxplot()\n```\n\nkayf tuawwil alqiam alshaadha waathar aldafae almuhtamal?",
            "Outliers could be real extremes or artifacts; if a batch aligns with them, that suggests batch effects.": "alshaadh yumkin an yakun haqiqiyan aw natiyya ean wasakh; idha tatawafqa mae dafae, fahadha yadul ealaa athar dafaei.",
            "What simple normalisation or transform would you try before plotting, and why?": "ma altatbiea aw altahwil albassit alladhi satujarribuh qabl alrasm walimadha?",
            "Use log1p(expr) to reduce skew and stabilise variance before group comparisons.": "istakhdim log1p(expr) litakhfif alenharaf wathabat almutaghayir qabl almuqarana.",

            "You trained a classifier on a biological outcomes dataset. How did you split the data and why?": "qamt bitadrib مصنف على بيانات نتائج بيولوجية. kayf qasamt albaynat walimadha?",
            "Used train_test_split with stratify on the label to preserve class balance; 70/30 split.": "استعملت train_test_split مع stratify على الوسم للحفاظ على توازن الفئات؛ تقسيم 70/30.",
            "Consider this code:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nWhat does the pipeline buy you?": "انظر إلى هذا الكود:\n\n```\npipeline = Pipeline([\n    (\"imputer\", SimpleImputer(strategy=\"median\")),\n    (\"scaler\", StandardScaler()),\n    (\"clf\", LogisticRegression(max_iter=1000))\n])\n```\n\nما فائدة هذا الـ pipeline؟",
            "It keeps preprocessing tied to the model and avoids leakage by fitting imputer/scaler only on train folds.": "يبقي المعالجة المسبقة مرتبطة بالنموذج ويتجنب التسرب بضبط imputer/scaler على بيانات التدريب فقط.",
            "You reported accuracy. What else would you show, and why?": "ذكرت الدقة. ماذا ستعرض أيضًا ولماذا؟",
            "Precision/recall/F1 and a confusion matrix to see class balance; maybe AUC if thresholding matters.": "الدقة/الاسترجاع/F1 ومصفوفة الالتباس لرؤية توازن الفئات؛ ربما AUC إذا كان العتبة مهمًا.",
            "Your validation curve shows train=0.99, val=0.78. What’s your next move?": "منحنى التحقق: train=0.99، val=0.78. ما الخطوة التالية؟",
            "Likely overfitting; reduce model complexity or add regularisation/feature selection; check data leakage.": "غالباً إفراط في التعميم؛ خفف تعقيد النموذج أو أضف تنظيم/اختيار ميزات؛ تحقق من التسرب.",

            "In your submission you argue that rewilding stabilises local ecosystems. Which mechanisms make that resilience possible?": "تقول إن إعادة التوحش تثبت النظم البيئية المحلية. ما الآليات التي تحقق ذلك؟",
            "Predators reset trophic cascades, which lets vegetation recover and boosts biodiversity.": "المفترسات تعيد ضبط السلاسل الغذائية فتتعافى النباتات وتزداد التنوع الحيوي.",
            "Push deeper: how does vegetation recovery translate into resilience during droughts?": "أعمق: كيف تتحول استعادة الغطاء النباتي إلى مرونة أثناء الجفاف؟",
            "More root mass and canopy cover keep moisture in soil, so shock events do less damage.": "كتلة جذور أكبر وتغطية مظلية تحفظ الرطوبة، فيقل تأثير الصدمات.",
            "Great. What’s the strongest counter-argument in densely populated regions?": "رائع. ما أقوى حجة مضادة في المناطق المأهولة؟",
            "Land-use conflict with existing agriculture; without incentives, farmers will block rewilding.": "صراع استخدام الأرض مع الزراعة؛ دون حوافز سيعارض المزارعون إعادة التوحش.",
            "If you could change one policy lever to address that, what would it be?": "لو غيرت أداة سياسة واحدة، ما هي؟",
            "Tiered subsidies tied to biodiversity metrics, plus guarantees that livestock corridors stay open.": "دعم متدرج مرتبط بمؤشرات التنوع الحيوي مع ضمان ممرات الماشية.",

            "Thanks for finishing the viva. Feedback: Strengths — good EDA hygiene in R (readr typing, NA checks) and awareness of spread and batch effects. Improve — always report n and variability, add distribution checks (hist/density), and note any batch adjustment. Include code to log-transform before plotting. Overall — solid EDA mindset; add robustness and transparency.": "شكرًا على إنهاء الفيفا. تغذية راجعة: نقاط قوة — عادات EDA جيدة في R (تعيين الأنواع في readr، فحص NA) ووعي بالتباين وتأثيرات الدُفعات. تحسين — أبلغ دائمًا عن n والتباين، أضف فحوص التوزيع (هيستوغرام/كثافة)، ووضح أي تعديل دفع. أدرج كود التحويل اللوغاريتمي قبل الرسم. إجمالًا — عقلية EDA قوية؛ زد من المتانة والشفافية.",
            "Thanks for finishing the viva. Feedback: Strengths — good on stratified splits, leakage prevention with pipelines, and richer metrics beyond accuracy. Improve — show calibration/threshold choice, justify regularisation values, and report cross-val variance. Overall — solid ML hygiene; add interpretability and robustness checks.": "شكرًا على إنهاء الفيفا. تغذية راجعة: نقاط قوة — تقسيمات طبقية جيدة، منع التسرب عبر pipelines، ومقاييس أوسع من الدقة. تحسين — أظهر المعايرة/اختيار العتبة، برر قيم التنظيم، وبلغ عن تباين التحقق المتقاطع. إجمالًا — نظافة ML قوية؛ أضف قابلية التفسير وفحوص المتانة.",
            "Thanks for finishing the viva. Feedback: Strengths — clear on trophic cascades and how they stabilise ecosystems; you tied mechanisms to resilience. Improve — sharpen the urban counter-argument with a specific risk scenario and data; propose one policy lever with trade-offs (e.g., tiered subsidies vs. land access). Overall — solid grasp of mechanisms; increase specificity and anticipate objections earlier.": "شكرًا على إنهاء الفيفا. تغذية راجعة: نقاط قوة — وضوح في السلاسل الغذائية وكيف تثبت الأنظمة؛ ربطت الآليات بالمرونة. تحسين — صِغ حجة مضادة حضرية أوضح مع سيناريو خطر وبيانات؛ اقترح أداة سياسة واحدة مع مفاضلات (مثل دعم متدرج مقابل الوصول إلى الأرض). إجمالًا — فهم جيد للآليات؛ زد التحديد وتوقع الاعتراضات مبكرًا."
        }
    };

    const normalizeKey = (str) => (str || "").replace(/\s+/g, " ").trim();
    const translationIndex = {};
    Object.entries(translations).forEach(([lang, map]) => {
        translationIndex[lang] = {};
        Object.entries(map).forEach(([k, v]) => {
            translationIndex[lang][normalizeKey(k)] = v;
        });
    });

    const translateText = (text, lang) => {
        if (!lang || lang === "en") return text;
        const idx = translationIndex[lang];
        const normalized = normalizeKey(text);
        if (idx && idx[normalized]) return idx[normalized];
        return text;
    };

    const escapeHtml = (str) => (str || "").replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[m]));

    const formatMessage = (text) => {
        const segments = [];
        const parts = (text || "").split(/```([\s\S]*?)```/g);
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 1) {
                // code segment
                segments.push(`<pre><code>${escapeHtml(parts[i].trim())}</code></pre>`);
            } else if (parts[i]) {
                segments.push(escapeHtml(parts[i]).replace(/\n/g, "<br>"));
            }
        }
        return segments.join("");
    };

    const addBubble = (sender, text) => {
        const bubble = document.createElement("div");
        bubble.className = `bubble ${sender}`;
        bubble.innerHTML = formatMessage(text);
        chatEl.appendChild(bubble);
        chatEl.scrollTop = chatEl.scrollHeight;
    };

    const addLoaderBubble = () => {
        const bubble = document.createElement("div");
        bubble.className = "bubble ai loader-bubble";
        bubble.innerHTML = `<div class="loader-dots"><span></span><span></span><span></span></div><span>   Preparing feedback — standby</span>`;
        chatEl.appendChild(bubble);
        chatEl.scrollTop = chatEl.scrollHeight;
        return bubble;
    };

    const addRatingBar = () => {
        const bubble = document.createElement("div");
        bubble.className = "bubble ai rating-bubble";
        bubble.innerHTML = `
            <div class="rating-title">Rate this viva experience:</div>
            <div class="rating-scale" role="group" aria-label="Rate viva experience">
                <span aria-label="Very unhappy">😞</span>
                <span aria-label="Unhappy">🙁</span>
                <span aria-label="Neutral">😐</span>
                <span aria-label="Happy">🙂</span>
                <span aria-label="Very happy">😊</span>
            </div>
        `;
        chatEl.appendChild(bubble);
        chatEl.scrollTop = chatEl.scrollHeight;
    };

    const fadeOutChat = () => {
        Array.from(chatEl.children).forEach((node) => node.classList.add("fade-out"));
        return new Promise((res) => schedule(() => {
            chatEl.innerHTML = "";
            res();
        }, 420));
    };

    const showThinking = () => {
        const thinking = document.createElement("div");
        thinking.className = "bubble ai thinking";
        thinking.innerHTML = `<span class="dots"><span></span><span></span><span></span></span>`;
        chatEl.appendChild(thinking);
        chatEl.scrollTop = chatEl.scrollHeight;
        return thinking;
    };

    const randomChar = () => {
        const chars = "abcdefghijklmnopqrstuvwxyz ";
        return chars[Math.floor(Math.random() * chars.length)];
    };

    const typeInInput = (text) => {
        return new Promise((resolve) => {
            inputEl.value = "";
            let i = 0;

            const tick = () => {
                // Occasional mistake
                if (Math.random() < 0.14 && i > 2 && i < text.length - 2) {
                    inputEl.value += randomChar();
                    inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
                    schedule(() => {
                        inputEl.value = inputEl.value.slice(0, -1); // backspace
                        inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
                        schedule(tick, 60);
                    }, 130);
                    return;
                }

                inputEl.value = text.slice(0, i + 1);
                inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
                inputEl.scrollLeft = inputEl.scrollWidth;
                i += 1;
                if (i < text.length) {
                    const speed = 58 + Math.random() * 70; // natural typing variance
                    schedule(tick, speed);
                } else {
                    schedule(resolve, 420);
                }
            };

            tick();
        });
    };

    const wait = (ms) => new Promise((res) => schedule(res, ms));

    const triggerFeedback = async () => {
        if (submitted) return;
        submitted = true;
        sendBtn.disabled = true;
        sendBtn.classList.remove("throb");
        sendBtn.textContent = "Submitted";
        await fadeOutChat();
        const loaderBubble = addLoaderBubble();
        await wait(4200 + Math.random() * 1200); // longer feedback prep
        loaderBubble.remove();
        const feedbackText = currentScenario && currentScenario.feedback
            ? currentScenario.feedback
            : "Thanks for finishing the viva. Feedback will be available soon.";
        const localizedFeedback = translateText(feedbackText, currentLanguage);
        addBubble("ai", localizedFeedback);
        addRatingBar();
        await wait(4000);
    };

    const handleTimerExpired = () => {
        if (endTriggered) return;
        endTriggered = true;
        countdownRemaining = 0;
        timerEl.textContent = "00:00";
        timerEl.classList.add("throb");
        sendBtn.classList.add("throb");
        sendBtn.disabled = false;
        sendBtn.textContent = "Submit";
        sendBtn.onclick = triggerFeedback;
    };

    const startCountdown = () => {
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            if (paused) return;
            countdownRemaining -= 1;
            if (countdownRemaining <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                handleTimerExpired();
            } else {
                timerEl.textContent = formatTime(countdownRemaining);
            }
        }, 1000);
    };

    const togglePause = () => {
        paused = !paused;
        playBtn.textContent = paused ? "Play" : "Pause";
        if (!paused && countdownInterval === null && !endTriggered) {
            startCountdown();
        } else if (paused && countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    };

    const handleNext = () => {
        paused = false;
        playBtn.textContent = "Pause";
        runSimulation();
    };

    const getScenarioPool = () => {
        // Limit to scenarios with translations when not in English
        if (currentLanguage === "en") return scenarios;
        // First three scenarios have fuller translations
        return scenarios.slice(0, 3);
    };

    const runSimulation = async () => {
        clearTimeline();
        const pool = getScenarioPool();
        // Always start with first pool item, then randomize thereafter
        currentScenario = firstRun ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
        const script = currentScenario.script;
        topicEl.textContent = currentScenario.title;
        chatEl.innerHTML = "";
        inputEl.value = "";
        heroPanel.classList.remove("fade");
        inputEl.disabled = true;
        inputEl.parentElement.classList.add("disabled");
        sendBtn.disabled = true;
        sendBtn.textContent = "Send";
        sendBtn.classList.remove("throb");
        timerEl.classList.remove("throb");
        loaderRow.hidden = true; // keep footer loader hidden during viva
        endTriggered = false;
        submitted = false;
        firstRun = false;
        sendBtn.onclick = null;
        paused = false;
        playBtn.textContent = "Pause";
        countdownRemaining = 60;
        timerEl.textContent = formatTime(countdownRemaining);
        startCountdown();

        for (let idx = 0; idx < script.length; idx++) {
            const step = script[idx];

            if (step.sender === "ai") {
                const thinking = showThinking();
                inputEl.disabled = true;
                inputEl.parentElement.classList.add("disabled");
                await wait(6500 + Math.random() * 1800);
                thinking.remove();
                const aiLine = translateText(step.text, currentLanguage);
                addBubble("ai", aiLine);
                inputEl.disabled = false;
                inputEl.parentElement.classList.remove("disabled");
                await wait(2200 + Math.random() * 1200); // reading time
            } else {
                const translated = translateText(step.text, currentLanguage);
                await typeInInput(translated);
                addBubble("user", translated);
                inputEl.value = "";
                if (endTriggered && !submitted) {
                    // If timer expired, trigger feedback right after this user message
                    await triggerFeedback();
                    break;
                }
                await wait(1200 + Math.random() * 900); // brief pause
            }
        }

        await wait(2800);
        heroPanel.classList.add("fade");
        await wait(2400); // keep feedback visible longer
        schedule(runSimulation, 300);
    };

    playBtn.addEventListener("click", togglePause);
    nextBtn.addEventListener("click", handleNext);
    if (navToggle && navLinks) {
        navToggle.addEventListener("click", () => {
            navLinks.classList.toggle("open");
        });
    }

    // Walkthrough modal
    const bookingButtons = document.querySelectorAll(".book-walkthrough");
    const bookingModal = document.querySelector("[data-booking-modal]");
    const bookingForm = document.querySelector("[data-booking-form]");
    const bookingSuccess = document.querySelector("[data-booking-success]");
    const bookingCloseButtons = document.querySelectorAll("[data-booking-close]");
    const holidayModal = document.querySelector("[data-holiday-modal]");
    const holidayCloseButtons = document.querySelectorAll("[data-holiday-close]");

    const openBooking = () => {
        if (bookingModal) bookingModal.classList.add("open");
        if (bookingForm) bookingForm.hidden = false;
        if (bookingSuccess) {
            bookingSuccess.hidden = true;
            bookingSuccess.classList.remove("visible");
        }
    };
    const closeBooking = () => {
        if (bookingModal) bookingModal.classList.remove("open");
    };

    bookingButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            openBooking();
        });
    });

    bookingCloseButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            closeBooking();
        });
    });

    if (bookingModal) {
        bookingModal.addEventListener("click", (e) => {
            if (e.target === bookingModal) closeBooking();
        });
    }

    // Holiday modal (capacity notice)
    const showHolidayModal = () => {
        if (!holidayModal) return;
        holidayModal.classList.add("open");
    };

    // reset dismissal each load so the notice can show after copy changes
    sessionStorage.removeItem("holidayNoticeDismissed");

    holidayCloseButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            if (holidayModal) holidayModal.classList.remove("open");
            sessionStorage.setItem("holidayNoticeDismissed", "1");
            if (bookingModal && e.target.classList.contains("book-walkthrough")) {
                openBooking();
            }
        });
    });

    const shouldShowHoliday = () => {
        if (sessionStorage.getItem("holidayNoticeDismissed") === "1") return;
        showHolidayModal();
    };

    window.addEventListener("scroll", () => {
        if (sessionStorage.getItem("holidayNoticeDismissed") === "1") return;
        if (window.scrollY > 200) {
            shouldShowHoliday();
        }
    }, { passive: true });

    // Fallback: show after 12s if not yet dismissed
    setTimeout(() => {
        shouldShowHoliday();
    }, 12000);

    if (bookingForm) {
        bookingForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const submitBtn = bookingForm.querySelector("button[type='submit']");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Sending...";
            }
            schedule(() => {
                if (bookingForm) bookingForm.hidden = true;
                if (bookingSuccess) {
                    bookingSuccess.hidden = false;
                    bookingSuccess.classList.add("visible");
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Submit";
                }
            }, 600);
        });
    }

    // Floating CTA visibility after hero
    const heroSection = document.querySelector(".hero");
    const floatingCta = document.querySelector(".floating-cta");
    const toggleFloatingCta = () => {
        if (!heroSection || !floatingCta) return;
        if (sessionStorage.getItem("floatingCtaDismissed") === "1") {
            floatingCta.classList.add("hidden");
            return;
        }
        const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
        const shouldShow = window.scrollY > heroBottom - 120;
        floatingCta.classList.toggle("visible", shouldShow);
    };
    window.addEventListener("scroll", toggleFloatingCta, { passive: true });
    toggleFloatingCta();

    if (floatingCta) {
        const closeEl = floatingCta.querySelector(".floating-cta-close");
        if (closeEl) {
            closeEl.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                floatingCta.classList.add("hidden");
                sessionStorage.setItem("floatingCtaDismissed", "1");
            });
        }
    }

    const dashTabs = document.querySelectorAll("[data-dash-tab]");
    const dashPanes = document.querySelectorAll("[data-dash-pane]");
    const switchPane = (target) => {
        dashTabs.forEach((t) => t.classList.toggle("active", t.getAttribute("data-dash-tab") === target));
        dashPanes.forEach((pane) => pane.classList.toggle("active", pane.getAttribute("data-dash-pane") === target));
    };

    dashTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const target = tab.getAttribute("data-dash-tab");
            switchPane(target);
        });
    });


    // Dashboard vs Settings view toggle
    const viewButtons = document.querySelectorAll("[data-view-switch]");
    const viewPanes = document.querySelectorAll("[data-view-pane]");
    const switchView = (target) => {
        viewButtons.forEach((b) => b.classList.toggle("active", b.getAttribute("data-view-switch") === target));
        viewPanes.forEach((pane) => pane.classList.toggle("active", pane.getAttribute("data-view-pane") === target));
    };
    viewButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            switchView(btn.getAttribute("data-view-switch"));
            if (tableNoteEl) {
                const showNote = btn.getAttribute("data-view-switch") === "dashboard" && document.querySelector("[data-dash-pane='table']").classList.contains("active");
                tableNoteEl.style.display = showNote ? "block" : "none";
            }
        });
    });
    switchView("dashboard");

    // Back to roster from transcript
    const backBtn = document.querySelector("[data-transcript-back]");
    if (backBtn) {
        backBtn.addEventListener("click", (e) => {
            e.preventDefault();
            switchPaneAndSetCycle("table");
        });
    }


    // Transcript data for roster rows
    const transcriptData = {
        "Calvin, Susan": {
            assignment: "Rewilding the UK",
            duration: "10:00",
            events: [
                { text: "No paste events detected", level: "ok" },
                { text: "Focus stable (0 blurs)", level: "ok" }
            ],
            feedback: "Nice chain from predators to reduced browse with a pilot example. To deepen it, you could add the % browse drop and sample size, give a livestock loss threshold that would challenge your claim, outline how compensation would trigger (e.g., GPS alert leads to verified claim), and name monitoring cadence and indicators (quarterly plots, camera traps, sapling survival). This would make a solid answer even sharper and more actionable.",
            summary: "Solid mechanism, stakeholders, and monitoring; needs harder UK numbers and trigger criteria. Integrity clean.",
            chat: [
                { sender: "ai", text: "Summarise your main claim in one sentence." },
                { sender: "user", text: "Reintroducing apex predators will cut deer browse and let UK woodlands recover." },
                { sender: "ai", text: "What evidence could challenge that?" },
                { sender: "user", text: "If livestock attacks rise or prey numbers crash instead of stabilising." },
                { sender: "ai", text: "Cite your strongest data point." },
                { sender: "user", text: "A fenced pilot in Northumberland saw browse damage drop 18% in two years." },
                { sender: "ai", text: "How will you mitigate farmer risk?" },
                { sender: "user", text: "Compensation funds plus GPS collars with geofencing alerts." },
                { sender: "ai", text: "What monitoring will you run?" },
                { sender: "user", text: "Quarterly vegetation plots and camera traps tracking deer and predator counts." },
                { sender: "ai", text: "Who must you align with?" },
                { sender: "user", text: "Local grazing boards and DEFRA; transparent incident logs in a co-managed board." },
                { sender: "ai", text: "How will you report progress?" },
                { sender: "user", text: "Annual public reports and town halls with farmers and residents." }
            ]
        },
        "Chen, Mei": {
            assignment: "Rewilding the UK",
            duration: "10:30",
            events: [
                { text: "Pacing irregular between Q1 → Q2", level: "warn" },
                { text: "No paste events detected", level: "ok" },
                { text: "Focus stable (1 blur)", level: "ok" }
            ],
            feedback: "Clear on cascades and metrics. You could add a UK counter-example and the numbers that would falsify your claim, offer one policy lever with a rough budget and who owns it, explain why NDVI and vegetation plots fit best, and attach thresholds/timelines to your success metrics. Those specifics would turn your thoughtful answers into a concise action plan.",
            summary: "Understands mechanism and metrics; needs UK risk/policy depth and steadier pacing. Integrity: pacing warning.",
            chat: [
                { sender: "ai", text: "Summarise your main claim in one sentence.", flag: "copy" },
                { sender: "user", text: "Predator reintroduction can stabilise UK upland ecosystems by restoring trophic cascades." },
                { sender: "ai", text: "What evidence would challenge your claim?" },
                { sender: "user", text: "If deer populations crashed or invasives filled the gap instead of native species." },
                { sender: "ai", text: "What policy would you propose?", flag: "copy" },
                { sender: "user", text: "A pilot zone with farmer incentives and independent ecological monitoring." },
                { sender: "ai", text: "Which data source is most reliable?" },
                { sender: "user", text: "Longitudinal vegetation plots and satellite NDVI trends from pilot zones." },
                { sender: "ai", text: "How will you measure success?" },
                { sender: "user", text: "Reduced browse damage, higher sapling survival, and more bird diversity over three seasons." },
                { sender: "ai", text: "Name one UK-specific risk." },
                { sender: "user", text: "Public backlash if livestock losses rise; we need transparent compensation rules." },
                { sender: "ai", text: "What mitigation would you trial first?" },
                { sender: "user", text: "Guard animals and fencing subsidies before scaling releases." }
            ]
        },
        "Hughes, Amina": {
            assignment: "Rewilding the UK",
            duration: "10:00",
            events: [
                { text: "Copy/paste events detected (2)", level: "warn", msgIndex: 3 },
                { text: "Focus stable (2 blurs)", level: "ok" }
            ],
            feedback: "Good risk framing and stakeholder focus. You could make it stronger by naming compensation triggers and buffer distances, stating what alerts or thresholds would prompt action, giving specific livestock loss and biodiversity targets, and pairing your dashboard with an update cadence and an example of what you’d share if incidents spike. Keeping answers in your own phrasing will reinforce clarity.",
            summary: "Gets trade-offs and comms; needs concrete mitigation steps and originality. Integrity: paste spikes flagged.",
            chat: [
                { sender: "ai", text: "State your claim about rewilding in one line.", flag: "copy" },
                { sender: "user", text: "Rewilding can restore biodiversity but must be paired with farmer protections." },
                { sender: "ai", text: "What protections are you proposing?" },
                { sender: "user", text: "Compensation funds, livestock guardian programs, and buffer zones.", flag: "paste" },
                { sender: "ai", text: "How will you monitor conflict risk?" },
                { sender: "user", text: "Track reported incidents and predator GPS data monthly.", flag: "paste" },
                { sender: "ai", text: "What’s the metric for success?" },
                { sender: "user", text: "Stable livestock losses plus upward trends in native species counts." },
                { sender: "ai", text: "Name a key stakeholder you must convince." },
                { sender: "user", text: "Local grazing cooperatives; we need early MOUs and transparency on incident data." },
                { sender: "ai", text: "How will you communicate outcomes?" },
                { sender: "user", text: "Quarterly public dashboards showing incidents, payouts, and biodiversity indicators." }
            ]
        },
        "Singh, Priya": {
            assignment: "Rewilding the UK",
            duration: "12:00",
            events: [
                { text: "Long pauses noted", level: "warn" },
                { text: "Low focus (5 blurs)", level: "warn" },
                { text: "No paste events detected", level: "ok" }
            ],
            feedback: "Your controls, replication plan, and success metrics were clear. To add depth: note specific threats (e.g., fence breaches) and how you’d detect them, give site selection criteria for replication, and add target ranges with check-in frequency for each metric. When asked about staying on track, propose a quick recap-and-confirm before moving on to show focus and ownership.",
            summary: "Methodical on controls/metrics; engagement risk from pauses/blurs. Integrity: low focus flagged.",
            chat: [
                { sender: "ai", text: "Describe your control plot setup.", flag: "copy" },
                { sender: "user", text: "Control plots keep grazing as usual; treatment plots reintroduce shrubs and reduce deer access." },
                { sender: "ai", text: "What would make your result less reliable?" },
                { sender: "user", text: "If fencing fails or if weather events skew growth; also small n could distort trends." },
                { sender: "ai", text: "How will you replicate this test?", flag: "copy" },
                { sender: "user", text: "Run n=30 plots across two regions and log soil moisture and temperature." },
                { sender: "ai", text: "What metrics define success?" },
                { sender: "user", text: "Higher sapling survival, lower browse marks, and more pollinator counts within 12 months." },
                { sender: "ai", text: "How do you address low focus during the viva?" },
                { sender: "user", text: "I’ll summarise each answer before moving on to stay on track." },
                { sender: "ai", text: "How will you handle unexpected outcomes?" },
                { sender: "user", text: "Log anomalies and adjust fencing or sampling frequency in the next cycle." }
            ]
        }
    };

    const transcriptSelectEl = document.querySelector(".transcript-select");
    const transcriptAssignmentEl = document.querySelector(".transcript-assignment");
    const transcriptDurationEl = document.querySelector(".transcript-duration");
    const transcriptChatEl = document.querySelector("[data-transcript-chat]");
    const transcriptEventsEl = document.querySelector(".transcript-events");
    const transcriptFeedbackEl = document.querySelector(".transcript-feedback");
    const transcriptSummaryEl = document.querySelector(".transcript-summary");
    const tableNoteEl = document.querySelector("[data-table-note]");

    const switchPaneAndSetCycle = (target) => {
        switchPane(target);
    };

    const renderTranscript = (name) => {
        const data = transcriptData[name];
        const fallback = !data;
        if (transcriptSelectEl) transcriptSelectEl.value = name;
        if (transcriptAssignmentEl) transcriptAssignmentEl.textContent = `Assignment: ${fallback ? "—" : data.assignment}`;
        if (transcriptDurationEl) transcriptDurationEl.textContent = `Duration: ${fallback ? "—" : data.duration || "—"}`;

        if (transcriptChatEl) {
            transcriptChatEl.innerHTML = "";
            const baseMessages = fallback ? [{ sender: "ai", text: "Transcript not available yet." }] : data.chat.slice();
            let messages = [...baseMessages];

            // Insert fabricated blur annotations in order, if any blurs were recorded
            const blurEvents = (data.events || [])
                .filter((ev) => /blur/i.test(ev.text) && /(\d+)/.test(ev.text))
                .map((ev) => {
                    const match = ev.text.match(/(\d+)/);
                    const count = match ? parseInt(match[1], 10) : 0;
                    return count;
                })
                .filter((count) => count > 0);

            const totalBlurs = blurEvents.reduce((sum, c) => sum + c, 0);
            if (totalBlurs > 0 && baseMessages.length > 2) {
                const positions = [];
                for (let i = 1; i <= totalBlurs; i++) {
                    const pos = Math.max(1, Math.floor((i * (baseMessages.length - 1)) / (totalBlurs + 1)));
                    positions.push(pos);
                }
                let inserted = 0;
                positions.forEach((pos, idx) => {
                    const minutes = 3 + idx;
                    const seconds = (12 + idx * 10) % 60;
                    const timeLabel = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
                    messages.splice(pos + inserted, 0, {
                        sender: "system",
                        text: `Blur event (${idx + 1} of ${totalBlurs}). Student navigated away from viva at ${timeLabel}.`
                    });
                    inserted += 1;
                });
            }

            messages.forEach((msg, idx) => {
                const div = document.createElement("div");
                div.className = `bubble ${msg.sender}${msg.alt ? " alt" : ""}`;
                const minute = Math.floor(idx * 0.75);
                const second = Math.floor((idx * 45) % 60);
                const ts = document.createElement("span");
                ts.className = "msg-ts";
                ts.textContent = `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
                const textSpan = document.createElement("span");
                textSpan.textContent = msg.text;
                div.appendChild(textSpan);
                div.appendChild(ts);
                if (msg.flag === "paste" || msg.flag === "copy") {
                    const badge = document.createElement("span");
                    badge.className = "msg-flag";
                    badge.textContent = msg.flag === "copy" ? "Copied" : "Pasted";
                    div.appendChild(badge);
                }
                transcriptChatEl.appendChild(div);
            });
        }

        if (transcriptEventsEl) {
            transcriptEventsEl.innerHTML = "";
            const events = fallback ? [{ text: "No integrity data.", level: "ok" }] : data.events || [];
            events.forEach((ev) => {
                const li = document.createElement("li");
                const dot = document.createElement("span");
                dot.className = `dot ${ev.level === "warn" ? "warn" : "ok"}`;
                li.appendChild(dot);
                li.appendChild(document.createTextNode(ev.text));
                transcriptEventsEl.appendChild(li);
            });
        }

        if (transcriptFeedbackEl) {
            transcriptFeedbackEl.innerHTML = "";
            const fb = fallback ? "Feedback pending." : data.feedback || "Feedback pending.";
            const p = document.createElement("p");
            p.textContent = fb;
            transcriptFeedbackEl.appendChild(p);
        }

        if (transcriptSummaryEl) {
            transcriptSummaryEl.innerHTML = "";
            const summaryText = fallback
                ? "Summary pending."
                : (data.summary || "Summary pending.");
            const p = document.createElement("p");
            p.textContent = summaryText;
            transcriptSummaryEl.appendChild(p);
        }

        if (tableNoteEl) {
            tableNoteEl.style.display = "none";
        }
    };

    document.querySelectorAll(".view-transcript").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const student = link.getAttribute("data-student");
            renderTranscript(student);
            switchView("dashboard");
            switchPaneAndSetCycle("transcript");
            if (tableNoteEl) tableNoteEl.style.display = "none";
        });
    });

    if (transcriptSelectEl) {
        transcriptSelectEl.addEventListener("change", (e) => {
            renderTranscript(e.target.value);
            switchPaneAndSetCycle("transcript");
        });
    }

    if (langSelect) {
        langSelect.addEventListener("change", (e) => {
            currentLanguage = e.target.value || "en";
            firstRun = true;
            runSimulation();
        });
    }

    runSimulation();
});
