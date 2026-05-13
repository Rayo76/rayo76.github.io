const form = document.getElementById("prompt-form");
const promptType = document.getElementById("promptType");
const categorySelect = document.getElementById("category");
const promptTabButtons = Array.from(document.querySelectorAll(".tab-btn[data-prompt-type]"));
const textFields = document.getElementById("textFields");
const imageFields = document.getElementById("imageFields");
const videoFields = document.getElementById("videoFields");
const imageMode = document.getElementById("imageMode");
const videoMode = document.getElementById("videoMode");
const imageBasicFields = document.getElementById("imageBasicFields");
const imageHighFields = document.getElementById("imageHighFields");
const videoBasicFields = document.getElementById("videoBasicFields");
const videoCinematicFields = document.getElementById("videoCinematicFields");
const generatedPayloadSection = document.getElementById("generatedPayloadSection");
const output = document.getElementById("output");
const tokenEstimateEl = document.getElementById("tokenEstimate");
const statusEl = document.getElementById("status");
const copyChatGptBtn = document.getElementById("copyChatGptBtn");
const copyClaudeBtn = document.getElementById("copyClaudeBtn");
const copyGeminiBtn = document.getElementById("copyGeminiBtn");
const copyGenericBtn = document.getElementById("copyGenericBtn");
const antiHallucinationGuard = document.getElementById("antiHallucinationGuard");
const stepLocking = document.getElementById("stepLocking");
const guardState = document.getElementById("guardState");
const stepLockState = document.getElementById("stepLockState");

let latestPayload = {};
let tokenEstimateTimerId = null;

const TEXT_PROCESS_STEPS = [
  "analyze input",
  "build itinerary",
  "calculate costs",
  "format output",
];
const TEXT_INPUT_MAX_CHARS = 220;
const TEXTAREA_MAX_CHARS = 1400;
const TOKEN_ESTIMATE_DEBOUNCE_MS = 260;
const REQUIRED_TEXT_FIELD_IDS = ["role", "objective", "context"];
const TEXT_TIP_FIELDS = {
  role: document.getElementById("role"),
  targetAudience: document.getElementById("targetAudience"),
  objective: document.getElementById("objective"),
  context: document.getElementById("context"),
  mustInclude: document.getElementById("mustInclude"),
  mustAvoid: document.getElementById("mustAvoid"),
};

const CATEGORY_FIELD_TIPS = {
  Travel: {
    role: "Trip planner assistant",
    targetAudience: "First-time travelers",
    objective: "Build a 5-day itinerary for Tokyo under a budget.",
    context: "Budget, constraints, travel dates, preferences, and any key details.",
    mustInclude: "Day-wise plan",
    mustAvoid: "Unverified assumptions",
  },
  Health: {
    role: "Preventive health advisor",
    targetAudience: "Working adults (ages 25-45)",
    objective: "Create a weekly wellness routine to improve sleep and energy.",
    context: "Sedentary lifestyle, 9-hour desk job, limited time on weekdays.",
    mustInclude: "Daily routine checklist",
    mustAvoid: "Medical diagnosis claims",
  },
  "Financial Planning": {
    role: "Personal finance coach",
    targetAudience: "Early-career professionals",
    objective: "Create a monthly budget and savings plan for emergency fund goals.",
    context: "Income, fixed expenses, variable spending, debt and risk tolerance.",
    mustInclude: "Savings allocation by category",
    mustAvoid: "Unrealistic return projections",
  },
  "App/PRD spec": {
    role: "Senior product manager",
    targetAudience: "Engineering + design teams",
    objective: "Draft a PRD for a task reminder app with MVP scope.",
    context: "Target users, business goal, problem statement, release timeline.",
    mustInclude: "User stories with acceptance criteria",
    mustAvoid: "Ambiguous feature definitions",
  },
  "Product Comparison": {
    role: "Research analyst",
    targetAudience: "Purchase decision makers",
    objective: "Compare 3 project management tools for a 20-person startup.",
    context: "Pricing limits, integrations, security requirements, team workflow.",
    mustInclude: "Feature matrix with pros/cons",
    mustAvoid: "Biased conclusions without evidence",
  },
  "Resume Optimization": {
    role: "ATS resume reviewer",
    targetAudience: "Software engineer job applicants",
    objective: "Optimize resume for backend engineer roles in product companies.",
    context: "Current resume content, target role, years of experience, skills.",
    mustInclude: "Keyword alignment suggestions",
    mustAvoid: "Fake achievements",
  },
  "Diet & Workout Plan": {
    role: "Fitness and nutrition planner",
    targetAudience: "Busy beginners",
    objective: "Create a 4-week fat-loss plan with home workouts.",
    context: "Age, weight, activity level, food preferences, equipment availability.",
    mustInclude: "Meal + workout split by day",
    mustAvoid: "Extreme calorie deficits",
  },
  "Education & Learning": {
    role: "Learning path coach",
    targetAudience: "Beginner data science learners",
    objective: "Create an 8-week study roadmap for Python and machine learning basics.",
    context: "Available study hours, prior knowledge, preferred learning format.",
    mustInclude: "Weekly milestones and practice tasks",
    mustAvoid: "Overloaded daily schedules",
  },
  "Debugging Issues": {
    role: "Senior debugging assistant",
    targetAudience: "Developers troubleshooting production bugs",
    objective: "Identify root cause and fix strategy for intermittent API timeout errors.",
    context: "Error logs, stack trace snippets, environment details, recent deploy changes.",
    mustInclude: "Reproduction steps and fix validation plan",
    mustAvoid: "Guess-based fixes without verification",
  },
  Other: {
    role: "",
    targetAudience: "",
    objective: "",
    context: "",
    mustInclude: "",
    mustAvoid: "",
  },
};

const listFromText = (value) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const readNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampNumber = (value, min, max, fallback) => {
  const parsed = readNumber(value, fallback);
  return Math.min(max, Math.max(min, parsed));
};

const getValue = (id) => (document.getElementById(id)?.value || "").trim();

const enforceHttpsIfNeeded = () => {
  const isHttp = window.location.protocol === "http:";
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";

  if (isHttp && !isLocalHost) {
    const secureUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(secureUrl);
  }
};

const applyInputConstraints = () => {
  const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
  const textAreas = Array.from(document.querySelectorAll("textarea"));
  const numberInputs = Array.from(document.querySelectorAll('input[type="number"]'));

  textInputs.forEach((input) => {
    if (!input.maxLength || input.maxLength < 1) {
      input.maxLength = TEXT_INPUT_MAX_CHARS;
    }
  });

  textAreas.forEach((area) => {
    if (!area.maxLength || area.maxLength < 1) {
      area.maxLength = TEXTAREA_MAX_CHARS;
    }
  });

  numberInputs.forEach((input) => {
    input.inputMode = "decimal";
  });
};

const isFieldVisible = (field) => field instanceof HTMLElement && !field.closest("[hidden]");

const ensureFieldErrorNode = (field) => {
  if (!field || !field.id) {
    return null;
  }

  const parent = field.parentElement;
  if (!parent) {
    return null;
  }

  let node = parent.querySelector(".field-error");
  if (!node) {
    node = document.createElement("small");
    node.className = "field-error";
    node.id = `${field.id}-error`;
    parent.appendChild(node);
  }

  return node;
};

const clearFieldError = (field) => {
  if (!field) {
    return;
  }

  field.classList.remove("input-invalid");
  field.removeAttribute("aria-invalid");

  const parent = field.parentElement;
  const node = parent ? parent.querySelector(".field-error") : null;
  if (node) {
    node.textContent = "";
    node.hidden = true;
  }
};

const showFieldError = (field, message) => {
  const node = ensureFieldErrorNode(field);
  if (!node) {
    return;
  }

  field.classList.add("input-invalid");
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", node.id);
  node.textContent = message;
  node.hidden = false;
};

const clearAllFieldErrors = () => {
  const fields = Array.from(form.querySelectorAll("input, textarea, select"));
  fields.forEach((field) => clearFieldError(field));
};

const getFieldValidationMessage = (field) => {
  if (!field || !isFieldVisible(field)) {
    return "";
  }

  const id = field.id || "";
  const value = (field.value || "").trim();

  if (promptType.value === "text" && REQUIRED_TEXT_FIELD_IDS.includes(id) && !value) {
    return "This field is required.";
  }

  if (field.matches('input[type="text"], textarea')) {
    const maxLength = field.maxLength > 0 ? field.maxLength : null;
    if (maxLength && value.length > maxLength) {
      return `Maximum ${maxLength} characters allowed.`;
    }
  }

  if (field.matches('input[type="number"]')) {
    if (!value) {
      return "";
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return "Enter a valid numeric value.";
    }

    const min = field.min !== "" ? Number(field.min) : null;
    const max = field.max !== "" ? Number(field.max) : null;

    if (min !== null && parsed < min) {
      return `Value must be at least ${min}.`;
    }

    if (max !== null && parsed > max) {
      return `Value must be at most ${max}.`;
    }
  }

  return "";
};

const validateVisibleFields = () => {
  const fields = Array.from(form.querySelectorAll("input, textarea, select")).filter(
    (field) => field.id && isFieldVisible(field)
  );
  const fieldErrors = {};

  fields.forEach((field) => {
    const message = getFieldValidationMessage(field);
    if (message) {
      fieldErrors[field.id] = message;
    }
  });

  return fieldErrors;
};

const revalidateFullFormState = () => {
  const fieldErrors = validateVisibleFields();
  const errors = Object.values(fieldErrors);

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
};

const renderFieldValidationErrors = (fieldErrors) => {
  clearAllFieldErrors();
  Object.entries(fieldErrors).forEach(([fieldId, message]) => {
    const field = document.getElementById(fieldId);
    if (field) {
      showFieldError(field, message);
    }
  });
};

const pruneEmpty = (value) => {
  if (Array.isArray(value)) {
    const cleanedArray = value
      .map((item) => pruneEmpty(item))
      .filter((item) => item !== null && item !== undefined && item !== "");
    return cleanedArray.length ? cleanedArray : undefined;
  }

  if (value && typeof value === "object") {
    const cleanedEntries = Object.entries(value).reduce((acc, [key, val]) => {
      const cleanedVal = pruneEmpty(val);
      const isEmptyObject =
        cleanedVal && typeof cleanedVal === "object" && !Array.isArray(cleanedVal)
          ? Object.keys(cleanedVal).length === 0
          : false;

      if (
        cleanedVal !== undefined &&
        cleanedVal !== null &&
        cleanedVal !== "" &&
        !isEmptyObject
      ) {
        acc[key] = cleanedVal;
      }
      return acc;
    }, {});
    return Object.keys(cleanedEntries).length ? cleanedEntries : undefined;
  }

  return value;
};

const estimateTokens = (text) => {
  const value = (text || "").trim();
  if (!value) {
    return 0;
  }

  const charEstimate = Math.ceil(value.length / 4);
  const wordCount = value.split(/\s+/).filter(Boolean).length;
  const punctuationCount = (value.match(/[.,!?;:()[\]{}"'-]/g) || []).length;
  const wordEstimate = Math.ceil(wordCount * 1.3 + punctuationCount * 0.1);

  return Math.max(1, Math.round((charEstimate + wordEstimate) / 2));
};

const getPromptTokenEstimate = (systemPrompt, userPrompt) => {
  const systemPromptTokens = estimateTokens(systemPrompt);
  const userPromptTokens = estimateTokens(userPrompt);

  return {
    method: "approximate_chars_words_v1",
    system_prompt_tokens: systemPromptTokens,
    user_prompt_tokens: userPromptTokens,
    total_prompt_tokens: systemPromptTokens + userPromptTokens,
  };
};

const toTextSystemInstruction = ({
  category,
  role,
  targetAudience,
  outputFormat,
  antiGuardEnabled,
}) => {
  const lines = [
    `You are acting as: ${role}.`,
    `Prompt category: ${category}.`,
    `Return output in ${outputFormat === "json" ? "JSON" : "Plain Text"}.`,
  ];

  if (targetAudience) {
    lines.push(`Target audience: ${targetAudience}.`);
  }

  if (antiGuardEnabled) {
    lines.push(
      'Anti-Hallucination Guard is ON: never guess facts; if unknown, explicitly say "unknown".'
    );
  }

  return lines.join(" ");
};

const toTextUserPrompt = ({ objective, context, mustInclude, mustAvoid }) => {
  const blocks = [`Objective:\n${objective}`, `Context (Most Crucial):\n${context}`];

  if (mustInclude.length) {
    blocks.push(`Must include:\n- ${mustInclude.join("\n- ")}`);
  }
  if (mustAvoid.length) {
    blocks.push(`Must avoid:\n- ${mustAvoid.join("\n- ")}`);
  }

  return blocks.join("\n\n");
};

const buildProviderPayloads = ({ systemInstruction, userPrompt, temperature, maxTokens }) => {
  const hasTemp = typeof temperature === "number";
  const hasMaxTokenLimit = typeof maxTokens === "number" && maxTokens > 0;

  const openaiPayload = {
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt },
    ],
    ...(hasTemp ? { temperature } : {}),
    ...(hasMaxTokenLimit ? { max_completion_tokens: maxTokens } : {}),
  };

  const anthropicPayload = {
    system: systemInstruction,
    messages: [{ role: "user", content: userPrompt }],
    ...(hasTemp ? { temperature } : {}),
    ...(hasMaxTokenLimit ? { max_tokens: maxTokens } : {}),
  };

  const geminiPayload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      ...(hasTemp ? { temperature } : {}),
      ...(hasMaxTokenLimit ? { maxOutputTokens: maxTokens } : {}),
    },
  };

  const genericPayload = {
    instruction: systemInstruction,
    input: userPrompt,
    settings: {
      ...(hasTemp ? { temperature } : {}),
      ...(hasMaxTokenLimit ? { max_tokens: maxTokens } : {}),
    },
  };

  return {
    openai: openaiPayload,
    anthropic: anthropicPayload,
    gemini: geminiPayload,
    generic: genericPayload,
  };
};

const toImagePromptText = (mode, promptObject) => {
  const serialized = JSON.stringify(promptObject);
  const compact = serialized.replace(/[{}"]/g, " ");
  return `Generate a high-quality ${mode} image using this structured brief: ${compact}. Return the final image only.`;
};

const normalizeAspectRatioForGemini = (value) => {
  const raw = (value || "").trim();
  if (!raw) {
    return undefined;
  }

  const valid = [
    "1:1",
    "3:4",
    "4:3",
    "16:9",
    "9:16",
    "21:9",
    "2:3",
    "3:2",
    "4:5",
    "5:4",
    "1:4",
    "4:1",
    "1:8",
    "8:1",
  ];

  return valid.includes(raw) ? raw : undefined;
};

const normalizeImageSizeForGemini = (value) => {
  const raw = (value || "").trim().toUpperCase();
  if (!raw) {
    return undefined;
  }

  const valid = ["512", "1K", "2K", "4K"];
  if (valid.includes(raw)) {
    return raw;
  }

  if (raw.includes("4096") || raw.includes("3840") || raw.includes("4K")) {
    return "4K";
  }
  if (raw.includes("2048") || raw.includes("2K")) {
    return "2K";
  }
  if (raw.includes("1024") || raw.includes("1K")) {
    return "1K";
  }
  if (raw.includes("512")) {
    return "512";
  }

  return undefined;
};

const buildImageProviderPayloads = ({ mode, promptObject }) => {
  const textPrompt = toImagePromptText(mode, promptObject);
  const output = promptObject?.output || {};
  const geminiAspectRatio = normalizeAspectRatioForGemini(output.aspect_ratio);
  const geminiImageSize = normalizeImageSizeForGemini(output.resolution);
  const imageQuality = output.quality === "high" ? "high" : "standard";

  const geminiGenerationConfig = {
    responseModalities: ["IMAGE"],
    imageConfig: {
      ...(geminiAspectRatio ? { aspectRatio: geminiAspectRatio } : {}),
      ...(geminiImageSize ? { imageSize: geminiImageSize } : {}),
    },
  };

  const hasGeminiImageConfig = Object.keys(geminiGenerationConfig.imageConfig).length > 0;
  if (!hasGeminiImageConfig) {
    delete geminiGenerationConfig.imageConfig;
  }

  return {
    openai: {
      model: "gpt-5",
      input: textPrompt,
      tool_choice: { type: "image_generation" },
      tools: [
        {
          type: "image_generation",
          size: output?.resolution || "1024x1024",
          quality: imageQuality,
        },
      ],
    },
    anthropic: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      tools: [
        {
          name: "generate_image",
          description: "Generate an image from a structured prompt and return base64 PNG bytes.",
          input_schema: {
            type: "object",
            properties: {
              prompt: { type: "string" },
              aspect_ratio: { type: "string" },
              quality: { type: "string" },
            },
            required: ["prompt"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "generate_image" },
      messages: [
        {
          role: "user",
          content: `Use the generate_image tool now. Do not output a text prompt. Prompt: ${textPrompt}`,
        },
      ],
    },
    gemini: {
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: textPrompt }],
        },
      ],
      generationConfig: geminiGenerationConfig,
    },
    generic: {
      request_type: "image_generation",
      action: "create_image",
      mode,
      prompt: textPrompt,
      return_format: "image_only",
      output: pruneEmpty(output) || {},
    },
  };
};

const buildTextPayload = ({ skipStrictValidation = false } = {}) => {
  const category = getValue("category") || "Other";
  const role = getValue("role");
  const targetAudience = getValue("targetAudience");
  const objective = getValue("objective");
  const context = getValue("context");
  const outputFormat = getValue("outputFormat") || "plain-text";
  const antiGuardEnabled = antiHallucinationGuard.checked;
  const stepLockingEnabled = stepLocking.checked;
  const mustInclude = listFromText(getValue("mustInclude"));
  const mustAvoid = listFromText(getValue("mustAvoid"));
  const temperature = Number(clampNumber(getValue("temperature"), 0.1, 0.9, 0.5).toFixed(1));
  const maxTokens = Math.floor(clampNumber(getValue("maxTokens"), 0, 1000, 500));

  if (!skipStrictValidation && (!role || !objective || !context)) {
    return {
      error: "Role, Objective, and Context are required for Text Prompting.",
    };
  }

  const systemInstruction = toTextSystemInstruction({
    category,
    role,
    targetAudience,
    outputFormat,
    antiGuardEnabled,
  });
  const userPrompt = toTextUserPrompt({
    objective,
    context,
    mustInclude,
    mustAvoid,
  });

  const promptTokenEstimate = getPromptTokenEstimate(systemInstruction, userPrompt);
  const validation = antiGuardEnabled
    ? { no_guessing: true, if_unknown: "say_unknown" }
    : { no_guessing: false, if_unknown: "best_effort" };
  const normalizedParameters = {
    temperature,
    ...(maxTokens > 0 ? { max_tokens: maxTokens } : {}),
  };

  return {
    payload: {
      task: "text",
      spec_version: "V4",
      created_at: new Date().toISOString(),
      category,
      role,
      target_audience: targetAudience || null,
      validation,
      ...(stepLockingEnabled ? { process: TEXT_PROCESS_STEPS } : {}),
      token_estimate: promptTokenEstimate,
      normalized_prompt: {
        system: systemInstruction,
        user: userPrompt,
        output_format: outputFormat,
        parameters: normalizedParameters,
      },
      provider_payloads: buildProviderPayloads({
        systemInstruction,
        userPrompt,
        temperature,
        maxTokens,
      }),
    },
  };
};

const buildImagePayload = () => {
  const mode = imageMode.value;

  const basicPrompt = {
    subject: getValue("imgBasicSubject"),
    style: getValue("imgBasicStyle"),
    scene: getValue("imgBasicScene"),
    lighting: getValue("imgBasicLighting"),
    composition: getValue("imgBasicComposition"),
  };

  const highQualityPrompt = {
    subject: {
      value: getValue("imgHqSubject"),
      type: getValue("imgSubjectType"),
      details: getValue("imgSubjectDetails"),
      action: getValue("imgSubjectAction"),
    },
    scene: {
      value: getValue("imgHqScene"),
      location: getValue("imgLocation"),
      environment: getValue("imgEnvironment"),
      time_of_day: getValue("imgTimeOfDay"),
      weather: getValue("imgWeather"),
    },
    style: {
      value: getValue("imgHqStyle"),
      genre: getValue("imgGenre"),
      inspiration: getValue("imgInspiration"),
      realism: getValue("imgRealism"),
      mood: getValue("imgMood"),
    },
    visual: {
      lighting: getValue("imgLighting"),
      colour_palette: getValue("imgColourPalette"),
      contrast: getValue("imgContrast"),
      textures: getValue("imgTextures"),
    },
    camera: {
      angle: getValue("imgAngle"),
      lens: getValue("imgLens"),
      depth_of_field: getValue("imgDepthOfField"),
      focus: getValue("imgFocus"),
    },
    composition: {
      value: getValue("imgHqComposition"),
      framing: getValue("imgFraming"),
      rule: getValue("imgRule"),
      motion: getValue("imgMotion"),
    },
    output: {
      resolution: getValue("imgResolution"),
      aspect_ratio: getValue("imgAspectRatio"),
      quality: getValue("imgQuality"),
    },
    constraints: {
      negative_prompt: getValue("imgNegativePrompt"),
      avoid: getValue("imgAvoid"),
    },
  };

  const prompt = mode === "basic" ? basicPrompt : highQualityPrompt;
  const cleanPrompt = pruneEmpty(prompt) || {};
  const imagePromptText = toImagePromptText(mode, cleanPrompt);
  const systemInstruction =
    "Generate a high-quality image directly from the provided brief. Do not return prompt text.";

  return {
    payload: {
      task: "image",
      spec_version: "V4",
      created_at: new Date().toISOString(),
      mode,
      prompt: cleanPrompt,
      token_estimate: getPromptTokenEstimate(systemInstruction, imagePromptText),
      provider_payloads: buildImageProviderPayloads({
        mode,
        promptObject: cleanPrompt,
      }),
    },
  };
};

const buildVideoPayload = () => {
  const mode = videoMode.value;

  const basicPrompt = {
    subject: getValue("vidBasicSubject"),
    style: getValue("vidBasicStyle"),
    scene: getValue("vidBasicScene"),
    duration_seconds: readNumber(getValue("vidBasicDuration"), 0),
    camera: getValue("vidBasicCamera"),
  };

  const cinematicPrompt = {
    subject: {
      value: getValue("vidSubject"),
      type: getValue("vidType"),
      details: getValue("vidDetails"),
      action: getValue("vidAction"),
    },
    scene: {
      value: getValue("vidScene"),
      location: getValue("vidLocation"),
      environment: getValue("vidEnvironment"),
      time_of_day: getValue("vidTimeOfDay"),
      weather: getValue("vidWeather"),
    },
    sequence: {
      shot: getValue("vidShot"),
      action: getValue("vidSequenceAction"),
      duration_seconds: readNumber(getValue("vidSequenceDuration"), 0),
    },
    camera: {
      movement: getValue("vidMovement"),
      angle: getValue("vidAngle"),
      lens: getValue("vidLens"),
      stabilization: getValue("vidStabilization"),
    },
    style: {
      genre: getValue("vidGenre"),
      mood: getValue("vidMood"),
      realism: getValue("vidRealism"),
      reference: getValue("vidReference"),
    },
    visual: {
      lighting: getValue("vidLighting"),
      color_grading: getValue("vidColorGrading"),
      effects: getValue("vidEffects"),
    },
    audio: {
      music: getValue("vidMusic"),
      sfx: getValue("vidSfx"),
      voiceover: getValue("vidVoiceover"),
    },
    output: {
      duration_seconds: readNumber(getValue("vidOutputDuration"), 0),
      resolution: getValue("vidResolution"),
      fps: getValue("vidFps"),
      aspect_ratio: getValue("vidAspectRatio"),
    },
    constraints: {
      negative_prompt: getValue("vidNegativePrompt"),
      avoid: getValue("vidAvoid"),
    },
  };

  const prompt = mode === "basic" ? basicPrompt : cinematicPrompt;
  const cleanPrompt = pruneEmpty(prompt) || {};
  const userPrompt = JSON.stringify(
    {
      task: "video",
      mode,
      prompt: cleanPrompt,
    },
    null,
    2
  );
  const systemInstruction =
    "Generate a production-ready video prompt from this structured JSON input.";

  return {
    payload: {
      task: "video",
      spec_version: "V4",
      created_at: new Date().toISOString(),
      mode,
      prompt: cleanPrompt,
      token_estimate: getPromptTokenEstimate(systemInstruction, userPrompt),
      provider_payloads: buildProviderPayloads({
        systemInstruction,
        userPrompt,
      }),
    },
  };
};

const renderPayload = (payload) => {
  output.textContent = JSON.stringify(payload, null, 2);
};

const renderTokenEstimate = (payload) => {
  const estimate = payload?.token_estimate;
  if (!estimate) {
    tokenEstimateEl.textContent = "Estimated prompt tokens - System: 0, User: 0, Total: 0";
    return;
  }

  tokenEstimateEl.textContent = `Estimated prompt tokens - System: ${estimate.system_prompt_tokens}, User: ${estimate.user_prompt_tokens}, Total: ${estimate.total_prompt_tokens}`;
};

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b6501d" : "#0d7a72";
};

const fallbackCopyText = (text) => {
  const tempTextArea = document.createElement("textarea");
  tempTextArea.value = text;
  tempTextArea.setAttribute("readonly", "");
  tempTextArea.style.position = "fixed";
  tempTextArea.style.left = "-9999px";
  tempTextArea.style.opacity = "0";
  document.body.appendChild(tempTextArea);
  tempTextArea.focus();
  tempTextArea.select();
  tempTextArea.setSelectionRange(0, tempTextArea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (_error) {
    copied = false;
  }

  tempTextArea.remove();
  return copied;
};

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      return fallbackCopyText(text);
    }
  }

  return fallbackCopyText(text);
};

const copyProviderPayload = async (providerKey, providerLabel) => {
  if (!Object.keys(latestPayload).length) {
    setStatus("Generate payload before copying provider prompts.", true);
    return;
  }

  const providerPayload = latestPayload?.provider_payloads?.[providerKey];
  if (!providerPayload) {
    setStatus(`No ${providerLabel} payload found to copy.`, true);
    return;
  }

  const copied = await copyTextToClipboard(JSON.stringify(providerPayload, null, 2));

  if (copied) {
    setStatus(`Copied ${providerLabel} payload to clipboard.`);
  } else {
    setStatus("Could not copy automatically in this browser context.", true);
  }
};

const syncGuardState = () => {
  guardState.textContent = antiHallucinationGuard.checked ? "On" : "Off";
  stepLockState.textContent = stepLocking.checked ? "On" : "Off";
};

const syncInterfaceVisibility = () => {
  const type = promptType.value;
  textFields.hidden = type !== "text";
  imageFields.hidden = type !== "image";
  videoFields.hidden = type !== "video";
};

const syncProviderButtonsVisibility = () => {
  const isTextPrompting = promptType.value === "text";
  copyClaudeBtn.hidden = !isTextPrompting;
};

const syncActiveTab = () => {
  promptTabButtons.forEach((button) => {
    const isActive = button.dataset.promptType === promptType.value;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
};

const syncImageModeVisibility = () => {
  const mode = imageMode.value;
  imageBasicFields.hidden = mode !== "basic";
  imageHighFields.hidden = mode !== "high_quality";
};

const syncVideoModeVisibility = () => {
  const mode = videoMode.value;
  videoBasicFields.hidden = mode !== "basic";
  videoCinematicFields.hidden = mode !== "cinematic";
};

const syncCategoryFieldTips = () => {
  const category = (categorySelect?.value || "Other").trim();
  const tips = CATEGORY_FIELD_TIPS[category] || CATEGORY_FIELD_TIPS.Other;

  Object.entries(TEXT_TIP_FIELDS).forEach(([key, field]) => {
    if (!field) {
      return;
    }
    field.placeholder = tips[key] || "";
  });
};

const buildPayloadForCurrentType = ({ preview = false } = {}) => {
  if (promptType.value === "text") {
    return buildTextPayload({ skipStrictValidation: preview });
  }
  if (promptType.value === "image") {
    return buildImagePayload();
  }
  return buildVideoPayload();
};

const scheduleTokenEstimateUpdate = () => {
  clearTimeout(tokenEstimateTimerId);
  tokenEstimateTimerId = setTimeout(() => {
    const previewResult = buildPayloadForCurrentType({ preview: true });
    if (previewResult?.payload?.token_estimate) {
      renderTokenEstimate(previewResult.payload);
    }
  }, TOKEN_ESTIMATE_DEBOUNCE_MS);
};

const validateFieldLive = (field) => {
  if (!(field instanceof HTMLElement) || !field.id) {
    return;
  }

  const message = getFieldValidationMessage(field);
  if (message) {
    showFieldError(field, message);
  } else {
    clearFieldError(field);
  }
};

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const validation = revalidateFullFormState();
  if (!validation.valid) {
    renderFieldValidationErrors(validation.fieldErrors);
    latestPayload = {};
    generatedPayloadSection.hidden = true;
    renderTokenEstimate(latestPayload);
    setStatus(validation.errors[0], true);
    return;
  }

  clearAllFieldErrors();
  const buildResult = buildPayloadForCurrentType();

  if (buildResult?.error) {
    latestPayload = {};
    generatedPayloadSection.hidden = true;
    renderTokenEstimate(latestPayload);
    setStatus(buildResult.error, true);
    return;
  }

  latestPayload = buildResult.payload;
  renderPayload(latestPayload);
  renderTokenEstimate(latestPayload);
  generatedPayloadSection.hidden = false;
  setStatus("JSON payload generated.");
});

copyChatGptBtn.addEventListener("click", async () => {
  await copyProviderPayload("openai", "ChatGPT");
});

copyClaudeBtn.addEventListener("click", async () => {
  await copyProviderPayload("anthropic", "Claude");
});

copyGeminiBtn.addEventListener("click", async () => {
  await copyProviderPayload("gemini", "Gemini");
});

copyGenericBtn.addEventListener("click", async () => {
  await copyProviderPayload("generic", "Generic");
});

promptTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    promptType.value = button.dataset.promptType;
    syncActiveTab();
    syncInterfaceVisibility();
    syncProviderButtonsVisibility();
    clearAllFieldErrors();
    scheduleTokenEstimateUpdate();
  });
});

imageMode.addEventListener("change", () => {
  syncImageModeVisibility();
  clearAllFieldErrors();
  scheduleTokenEstimateUpdate();
});
videoMode.addEventListener("change", () => {
  syncVideoModeVisibility();
  clearAllFieldErrors();
  scheduleTokenEstimateUpdate();
});
antiHallucinationGuard.addEventListener("change", syncGuardState);
stepLocking.addEventListener("change", syncGuardState);
form.addEventListener("input", (event) => {
  validateFieldLive(event.target);
  scheduleTokenEstimateUpdate();
});
form.addEventListener("change", (event) => {
  validateFieldLive(event.target);
  scheduleTokenEstimateUpdate();
});
categorySelect.addEventListener("change", () => {
  syncCategoryFieldTips();
  scheduleTokenEstimateUpdate();
});



enforceHttpsIfNeeded();
applyInputConstraints();
syncGuardState();
syncActiveTab();
syncInterfaceVisibility();
syncProviderButtonsVisibility();
syncImageModeVisibility();
syncVideoModeVisibility();
syncCategoryFieldTips();
renderTokenEstimate(latestPayload);


async function clearClipboardAfterDelay(delayMs = 60000) {
  if (!navigator.clipboard || !window.isSecureContext) return;

  setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current) {
        await navigator.clipboard.writeText('');
      }
    } catch {
      // Clipboard access may be denied by the browser; ignore.
    }
  }, delayMs);
}

await navigator.clipboard.writeText(text);
clearClipboardAfterDelay(); // Clears clipboard after 60 seconds