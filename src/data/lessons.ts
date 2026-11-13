export interface Lesson {
  id: string;
  title: string;
  body: string;
  example: string;
  quiz: { q: string; options: [string, string, string]; answer: 0 | 1 | 2; why: string };
}

/** Offline fallback. /api/lesson (OpenAI) replaces this when it is configured. */
export const LESSONS: Lesson[] = [
  {
    id: "tokens",
    title: "Tokens are what models actually read",
    body: "A tokenizer cuts text into pieces and the model only ever sees integer IDs for those pieces. Price, speed and the context limit are all counted in tokens. English averages roughly four characters per token; code, numbers and many other languages split into more.",
    example: "“unbelievable” can become un + believ + able: three tokens for one word.",
    quiz: {
      q: "Why do APIs bill in tokens rather than words?",
      options: ["Tokens are the unit the model processes", "Words are trademarked", "A token is always one character"],
      answer: 0,
      why: "Compute scales with the number of tokens the model reads and writes, not with how many words they form.",
    },
  },
  {
    id: "context",
    title: "The context window is shared by input and output",
    body: "The window is everything the model can look at in one go: your prompt, earlier turns, retrieved documents and the reply it is writing. Fill it with input and there is less room to answer. Models also tend to use the middle of a very long input less reliably than its start and end.",
    example: "A 128k window with a 120k prompt leaves about 8k tokens for the answer.",
    quiz: {
      q: "What counts against the context window?",
      options: ["Only your prompt", "Your prompt and the model's reply", "Only the reply"],
      answer: 1,
      why: "Input and output tokens share the same budget.",
    },
  },
  {
    id: "temperature",
    title: "Temperature is a randomness dial",
    body: "At each step the model scores every possible next token. Temperature reshapes those scores before one is drawn: near 0 the top token nearly always wins, higher values give lower-ranked tokens a real chance. Use low values for extraction and code, higher for brainstorming.",
    example: "Temperature 0 on “The sky is” keeps saying “blue”. At 1.2 you will see stranger endings.",
    quiz: {
      q: "You need consistent JSON extraction. Which setting?",
      options: ["Temperature 0 to 0.2", "Temperature 1.5", "It makes no difference"],
      answer: 0,
      why: "Low temperature keeps output stable between runs, which is what parsing needs.",
    },
  },
  {
    id: "embeddings",
    title: "Embeddings turn meaning into geometry",
    body: "An embedding model maps text to a list of numbers so that similar meanings land close together. Search then becomes a nearest-neighbour lookup, usually with cosine similarity, which compares the direction two vectors point rather than their length.",
    example: "“refund policy” and “how do I get my money back” end up near each other with no shared keywords.",
    quiz: {
      q: "What does cosine similarity compare?",
      options: ["The direction two vectors point", "How long the texts are", "How many words they share"],
      answer: 0,
      why: "It measures the angle between vectors, so length drops out.",
    },
  },
  {
    id: "rag",
    title: "RAG is a search problem first",
    body: "Retrieval-augmented generation looks up relevant chunks and places them in the prompt, so the model can answer from fresh or private data without retraining. When answers are wrong, the cause is usually that the right chunk was never retrieved, not that the model reasoned badly.",
    example: "Question → embed → top 5 chunks → prompt with those chunks → answer with sources.",
    quiz: {
      q: "The right document exists but answers are wrong. What do you check first?",
      options: ["Whether retrieval returned the right chunks", "Use a bigger model", "Raise the temperature"],
      answer: 0,
      why: "If the evidence never reaches the prompt, no model can use it.",
    },
  },
  {
    id: "attention",
    title: "Attention is why long inputs cost more",
    body: "In each layer every token weighs every earlier token to decide what is relevant. Full attention therefore grows with the square of the sequence length, which is why long contexts are slow and expensive and why so much research goes into cheaper variants.",
    example: "Going from 8k to 16k tokens roughly quadruples the attention work.",
    quiz: {
      q: "Doubling the input length does what to full-attention compute?",
      options: ["Doubles it", "Roughly quadruples it", "Leaves it unchanged"],
      answer: 1,
      why: "Every token attends to every other, so the work scales with length squared.",
    },
  },
  {
    id: "kv-cache",
    title: "The KV cache is why prompt caching works",
    body: "While generating, the model keeps the key and value vectors of earlier tokens so each new token needs only incremental work. Providers reuse that stored work when two requests start with the identical prefix, which is why stable text belongs at the top of a prompt.",
    example: "Put the system prompt and tool list first; put the changing user question last.",
    quiz: {
      q: "Why put stable text at the start of a prompt?",
      options: ["Caches match on identical prefixes", "Models read the start more carefully", "It shortens the prompt"],
      answer: 0,
      why: "A change early in the prompt invalidates everything cached after it.",
    },
  },
  {
    id: "quantization",
    title: "Quantization trades a little accuracy for a lot of memory",
    body: "Weights are normally stored in 16 bits. Rounding them to 8 or 4 bits shrinks memory and speeds up inference, usually at a small quality cost. It is the main reason models with billions of parameters now run on laptops.",
    example: "A 7-billion-parameter model needs about 14 GB at 16-bit and about 3.5 GB at 4-bit, before overhead.",
    quiz: {
      q: "Moving weights from 16-bit to 4-bit cuts their memory by about:",
      options: ["2×", "4×", "16×"],
      answer: 1,
      why: "16 bits divided by 4 bits is a factor of four.",
    },
  },
  {
    id: "tool-use",
    title: "Tool use: the model asks, your code acts",
    body: "A model cannot run code or call an API itself. It emits a structured request naming a tool and its arguments; your application executes it and returns the result in the next message. All safety checks and permissions live in your code, not in the model.",
    example: "{ name: \"get_weather\", args: { city: \"Pune\" } } → you call the API → result goes back to the model.",
    quiz: {
      q: "Who executes a tool call?",
      options: ["The model", "Your application", "The tokenizer"],
      answer: 1,
      why: "The model only proposes the call; your code decides whether and how to run it.",
    },
  },
  {
    id: "moe",
    title: "Mixture of experts: big model, small bill",
    body: "A mixture-of-experts layer holds many expert sub-networks and a router that sends each token to only a few of them. Total parameters are large, but the compute per token is that of a much smaller model.",
    example: "A model with 8 experts per layer might activate 2 per token, using roughly a quarter of the expert compute.",
    quiz: {
      q: "In a mixture-of-experts layer, per token:",
      options: ["Every expert runs", "Only a few experts run", "Only one layer runs"],
      answer: 1,
      why: "The router selects a small subset, which is the whole point.",
    },
  },
  {
    id: "evals",
    title: "No evals means comparing vibes",
    body: "An eval is a fixed set of inputs with a way to score the outputs, re-run after every prompt or model change. Start small: twenty real failures you have actually seen beat a thousand synthetic cases, and each new bug becomes a new test.",
    example: "Keep a spreadsheet: input, expected behaviour, pass or fail, date last checked.",
    quiz: {
      q: "Best first eval set?",
      options: ["Real failures you have seen", "Random internet text", "Only easy cases"],
      answer: 0,
      why: "They represent the mistakes that matter and keep the suite honest.",
    },
  },
  {
    id: "hallucination",
    title: "Hallucination is fluency without checking",
    body: "A language model produces the most plausible continuation, not a verified fact, so it can state false things in a confident tone. Grounding answers in retrieved sources, allowing “I don't know”, and checking citations against the source cut the rate far more than asking it to be careful.",
    example: "Ask for a quote and a link, then check that the quote exists on that page.",
    quiz: {
      q: "Which reduces hallucination most reliably?",
      options: ["Ground answers in retrieved sources", "Tell it to sound confident", "Ask for longer answers"],
      answer: 0,
      why: "Evidence in the prompt gives the model something real to draw on and you something to verify.",
    },
  },
];
