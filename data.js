// Publications data
const publications = [
    {
        title: "DyG-Mamba: Continuous State Space Modeling on Dynamic Graphs",
        authors: "Dongyuan Li, Shiyin Tan, Ying Zhang*, Ming Jin, Shirui Pan, Manabu Okumura, Renhe Jiang",
        venue: "The Thirty-Ninth Annual Conference on Neural Information Processing Systems (NeurIPS 2025)",
        links: [
        ]
    },
    {
        title: "S2N: A Synthetic Data-Driven Approach for Speaker-to-Dialogue Attribution in Novels",
        authors: "Yiqian Huang, Ying Zhang*, Kotaro Funakoshi, Manabu Okumura, and Yang Cao",
        venue: "International Joint Conference on Neural Networks (IJCNN2025)",
        links: [{ text: "presentation", url: "https://vimeo.com/1095995250" }]
    },
    {
        title: "Revisiting Dynamic Graph Clustering via Matrix Factorization",
        authors: "Dongyuan Li, Satoshi Kosugi, Ying Zhang*, Manabu Okumura, Feng Xia, and Renhe Jiang",
        venue: "International World Wide Web Conference 2025 (WWW 2025)",
        links: [
            { text: "paper", url: "https://openreview.net/forum?id=QOxEHegLSg#discussion" }
        ]
    },
    {
        title: "Active Learning for Abstractive Text Summarization via LLM-Determined Curriculum and Certainty Gain Maximization",
        authors: "Dongyuan Li, Ying Zhang*, Zhen Wang, Shiyin Tan, Satoshi Kosugi, and Manabu Okumura",
        venue: "Findings of the Association for Computational Linguistics: EMNLP 2024",
        links: [
            { text: "paper", url: "https://aclanthology.org/2024.findings-emnlp.523/" }
        ]
    },
    {
        title: "FINE-LMT: Fine-grained Feature Learning for Multi-Modal Machine Translation",
        authors: "Yusong Wang, Ying Zhang*, Dongyuan Li, Jialun Shen, Yicheng Xu, Mingkun Xu, Kotaro Funakoshi, and Manabu Okumura",
        venue: "The Pacific Rim International Conference on Artificial Intelligence (PRICAI 2024)",
        links: [
            { text: "paper", url: "https://link.springer.com/chapter/10.1007/978-981-96-0119-6_32" }
        ]
    },
    {
        title: "Community-Invariant Graph Contrastive Learning",
        authors: "Shiyin Tan, Dongyuan Li, Renhe Jiang, Ying Zhang*, and Manabu Okumura",
        venue: "Forty-first International Conference on Machine Learning (ICML 2024)",
        links: [
            { text: "paper", url: "https://proceedings.mlr.press/v235/tan24b.html" }
        ]
    },
    {
        title: "Active Learning with Task Adaptation Pre-training for Speech Emotion Recognition",
        authors: "Dongyuan Li, Ying Zhang*, Yusong Wang, Kataro Funakoshi, and Manabu Okumura",
        venue: "Journal of Natural Language Processing (JNLP 2024)",
        links: [
            { text: "paper", url: "https://www.jstage.jst.go.jp/article/jnlp/31/3/31_825/_pdf/-char/ja" }
        ]
    },
    {
        title: "Bidirectional Transformer Reranker for Grammatical Error Correction",
        authors: "Ying Zhang*, Hidetaka Kamigaito, and Manabu Okumura",
        venue: "Journal of Natural Language Processing (JNLP 2024), Volume 31, Issue 1",
        links: [
            { text: "paper", url: "https://www.jstage.jst.go.jp/article/jnlp/31/1/31_3/_pdf/-char/ja" }
        ]
    },
    {
        title: "Bidirectional Transformer Reranker for Grammatical Error Correction",
        authors: "Ying Zhang*, Hidetaka Kamigaito, and Manabu Okumura",
        venue: "Findings of the Association for Computational Linguistics: ACL 2023, pp. 3801-3825, long paper",
        links: [
            { text: "paper", url: "https://aclanthology.org/2023.findings-acl.234.pdf" },
            { text: "bib", url: "https://aclanthology.org/2023.findings-acl.234.bib" },
            { text: "presentation", url: "paper_document/btr_presentation.pdf" },
            { text: "poster", url: "paper_document/btr_poster.pdf" },
            { text: "code", url: "https://github.com/zhangying9128/BTR" }
        ]
    },
    {
        title: "Generic Mechanism for Reducing Repetitions in Encoder-Decoder Models",
        authors: "Ying Zhang*, Hidetaka Kamigaito, Tatsuya Aoki, Hiroya Takamura, and Manabu Okumura",
        venue: "Journal of Natural Language Processing (JNLP 2023), Volume 30, Issue 2, pp. 401-431",
        links: [
            { text: "paper", url: "https://www.jstage.jst.go.jp/article/jnlp/30/2/30_401/_pdf/-char/en" },
            { text: "bib", url: "https://www.jstage.jst.go.jp/AF06S010ShoshJkuDld?sryCd=jnlp&noVol=30&noIssue=2&kijiCd=30_401&kijiLangKrke=en&kijiToolIdHkwtsh=AT0073&request_locale=EN" },
            { text: "code", url: "https://github.com/zhangying9128/RRM" }
        ]
    },
    {
        title: "A Language Model-based Generative Classifier for Sentence-level Discourse Parsing",
        authors: "Ying Zhang*, Hidetaka Kamigaito, and Manabu Okumura",
        venue: "Proceedings of the 2021 Conference on Empirical Methods in Natural Language Processing (EMNLP 2021), pp. 2432-2446, long paper",
        links: [
            { text: "paper", url: "https://aclanthology.org/2021.emnlp-main.188.pdf" },
            { text: "bib", url: "https://aclanthology.org/2021.emnlp-main.188.bib" },
            { text: "presentation", url: "paper_document/lmgc_presentation.pdf" },
            { text: "poster", url: "paper_document/lmgc_poster.pdf" },
            { text: "code", url: "https://github.com/zhangying9128/LMGC" }
        ]
    },
    {
        title: "Generic Mechanism for Reducing Repetitions in Encoder-Decoder Models",
        authors: "Ying Zhang*, Hidetaka Kamigaito, Tatsuya Aoki, Hiroya Takamura, and Manabu Okumura",
        venue: "Proceedings of the International Conference Recent Advances in Natural Language Processing (RANLP 2021), pp. 1606-1615",
        links: [
            { text: "paper", url: "https://aclanthology.org/2021.ranlp-1.180.pdf" },
            { text: "bib", url: "https://aclanthology.org/2021.ranlp-1.180.bib" },
            { text: "presentation", url: "paper_document/rrm_presentation.pdf" },
            { text: "code", url: "https://github.com/zhangying9128/RRM" }
        ]
    }
];

// Academic timeline data
const timeline = [
    {
        date: "2024 May - Now",
        title: "RIKEN",
        subtitle: "Postdoc in Natural Language Understanding Team",
        details: "Advisors: Dr. Benjamin Heinzerling & Dr. Kentaro Inui"
    },
    {
        date: "2023 Nov. - 2024 Apr.",
        title: "Tokyo Institute of Technology",
        subtitle: "Postdoc in Okumura-Funakoshi's Lab",
        details: "Advisor: Dr. Manabu Okumura"
    },
    {
        date: "2019 - 2023",
        title: "Tokyo Institute of Technology",
        subtitle: "Doctoral course in Information and Communications Engineering",
        details: "Research assistant in Okumura-Funakoshi's Lab and RIKEN. Advisors: Dr. Hidetaka Kamigaito & Dr. Manabu Okumura"
    },
    {
        date: "2019 - 2019",
        title: "Fujitsu Laboratories LTD.",
        subtitle: "Research scientist (Intern) in Artificial Intelligence Laboratory",
        details: "Advisor: Dr. Takuya Makino"
    },
    {
        date: "2017 - 2019",
        title: "Tokyo Institute of Technology",
        subtitle: "Master's course in Information and Communications Engineering",
        details: "Research assistant in Okumura-Takamura's Lab. Advisors: Dr. Hiroya Takamura & Dr. Manabu Okumura"
    },
    {
        date: "2013 - 2017",
        title: "Chongqing University",
        subtitle: "B.S. in Information Management and Information System",
        details: "Advisor: Dr. Xiaoqiang Gao"
    }
];

// Research funding data
const researchFunding = [
    {
        title: "RIKEN Incentive Research Projects",
        amount: "3,000,000 JPY",
        period: "April 2025 — March 2027"
    }
];

