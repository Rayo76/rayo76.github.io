// ====================== UNIVERSAL LLM PROMPT BUILDER ======================

/**
 * Handle Category Change
 */
const handleCategoryChange = (event) => {
    console.log(`Category changed to: ${event.target.value}`);
};

const initializeFormListeners = () => {
    const categorySelector = document.getElementById('category');
    if (categorySelector) {
        categorySelector.addEventListener('change', handleCategoryChange);
    }
};

document.addEventListener('DOMContentLoaded', initializeFormListeners);


// ===================================================================
// TAB SWITCHING
// ===================================================================

(() => {
    function switchTab(tabType) {
        document.querySelectorAll('.interface-section').forEach(s => s.hidden = true);
        const target = document.getElementById(tabType + 'Fields');
        if (target) target.hidden = false;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.promptType === tabType);
        });

        document.getElementById('promptType').value = tabType;
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.promptType));
        });
        switchTab('text');
    });
})();


// ===================================================================
// CATEGORY PLACEHOLDERS
// ===================================================================

(() => {
    const categoryTemplates = {
        "Travel": { role: "Expert travel planner", targetAudience: "First-time travelers", objective: "Build a 5-day itinerary for Tokyo", context: "Budget, dates, preferences", mustInclude: "Day-wise plan\nBudget", mustAvoid: "Unsafe recommendations" },
        "Health": { role: "Certified health coach", targetAudience: "Busy professionals", objective: "30-day wellness plan", context: "Age, lifestyle", mustInclude: "Routine\nMeals", mustAvoid: "Medical advice" },
        "Financial Planning": { role: "Certified financial planner", targetAudience: "Young professionals", objective: "5-year financial roadmap", context: "Income, goals", mustInclude: "Budget\nInvestments", mustAvoid: "Stock tips" },
        "App/PRD spec": { role: "Senior Product Manager", targetAudience: "Development team", objective: "Complete PRD document", context: "App requirements", mustInclude: "User stories\nFeatures", mustAvoid: "Code snippets" },
        "Product Comparison": { role: "Tech analyst", targetAudience: "Buyers", objective: "Unbiased product comparison", context: "User needs", mustInclude: "Pros/Cons table", mustAvoid: "Bias" },
        "Resume Optimization": { role: "Professional resume writer", targetAudience: "Job seekers", objective: "ATS-optimized resume", context: "Target role", mustInclude: "Achievements", mustAvoid: "Generic text" },
        "Diet & Workout Plan": { role: "Nutritionist & Trainer", targetAudience: "Fitness enthusiasts", objective: "12-week transformation plan", context: "Goals & restrictions", mustInclude: "Meal & workout plan", mustAvoid: "Extreme diets" },
        "Education & Learning": { role: "Curriculum designer", targetAudience: "Students", objective: "Structured learning path", context: "Current level", mustInclude: "Weekly schedule", mustAvoid: "Overload" },
        "Debugging Issues": { role: "Senior Debugging Expert", targetAudience: "Developers", objective: "Systematic fix guide", context: "Tech stack & symptoms", mustInclude: "Step-by-step", mustAvoid: "Guesses" },
        "Other": { role: "", targetAudience: "", objective: "", context: "", mustInclude: "", mustAvoid: "" }
    };

    function applyCategoryPlaceholders() {
        const cat = document.getElementById('category')?.value;
        if (!cat) return;
        const t = categoryTemplates[cat] || categoryTemplates["Other"];

        ['role','targetAudience','objective','context','mustInclude','mustAvoid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.placeholder = t[id] || '';
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const sel = document.getElementById('category');
        if (sel) {
            applyCategoryPlaceholders();
            sel.addEventListener('change', () => setTimeout(applyCategoryPlaceholders, 0));
        }
    });
})();


// ===================================================================
// GENERATE + COPY + IMPROVED TOKEN ESTIMATION
// ===================================================================

(() => {
    function getFormData() {
        const data = { promptType: document.getElementById('promptType').value };

        ['category','role','targetAudience','objective','context','mustInclude','mustAvoid',
         'temperature','maxTokens','outputFormat'].forEach(id => {
            const el = document.getElementById(id);
            if (el) data[id] = el.value.trim();
        });

        data.antiHallucinationGuard = document.getElementById('antiHallucinationGuard')?.checked || false;
        data.stepLocking = document.getElementById('stepLocking')?.checked || false;

        if (data.promptType === 'image') {
            data.imageMode = document.getElementById('imageMode')?.value;
            document.querySelectorAll('#imageFields input, #imageFields textarea, #imageFields select').forEach(el => {
                if (el.id) data[el.id] = el.value.trim();
            });
        }
        if (data.promptType === 'video') {
            data.videoMode = document.getElementById('videoMode')?.value;
            document.querySelectorAll('#videoFields input, #videoFields textarea, #videoFields select').forEach(el => {
                if (el.id) data[el.id] = el.value.trim();
            });
        }
        return data;
    }

    /** Improved Token Estimation */
    function estimateTokens(data) {
        let charCount = 0;

        // Count main content
        ['role','targetAudience','objective','context','mustInclude','mustAvoid'].forEach(key => {
            if (data[key]) charCount += data[key].length;
        });

        // Image/Video fields
        if (data.promptType === 'image' || data.promptType === 'video') {
            Object.keys(data).forEach(key => {
                if ((key.startsWith('img') || key.startsWith('vid')) && data[key]) {
                    charCount += data[key].length + 30; // + label overhead
                }
            });
        }

        // Base system prompt + formatting
        const baseTokens = data.promptType === 'text' ? 180 : 120;
        const contentTokens = Math.ceil(charCount / 4); // ~4 chars per token

        const totalTokens = baseTokens + contentTokens + 80; // overhead

        return {
            system: Math.round(baseTokens * 0.6),
            user: Math.round(totalTokens * 0.4),
            total: totalTokens
        };
    }

    function buildPromptForProvider(provider, data) {
        let prompt = '';

        if (data.promptType === 'text') {
            prompt = `You are ${data.role || 'a helpful assistant'}.\n\n`;
            prompt += `Target Audience: ${data.targetAudience || 'General audience'}\n\n`;
            prompt += `Objective: ${data.objective || 'Help with the request'}\n\n`;
            prompt += `Context: ${data.context || 'No additional context'}\n\n`;

            if (data.mustInclude) prompt += `Must Include:\n${data.mustInclude}\n\n`;
            if (data.mustAvoid) prompt += `Must Avoid:\n${data.mustAvoid}\n\n`;

            prompt += `Anti-Hallucination: ${data.antiHallucinationGuard ? 'STRICT' : 'Normal'}\n`;
            prompt += `Step-by-Step Reasoning: ${data.stepLocking ? 'ENABLED' : 'DISABLED'}\n\n`;
            prompt += `Output Format: ${data.outputFormat === 'json' ? 'Valid JSON only' : 'Clear, well-structured text'}\n`;

        } else if (data.promptType === 'image') {
            prompt = `Generate a high-quality image with the following specifications:\n\n`;
            Object.keys(data).filter(k => k.startsWith('img')).forEach(key => {
                if (data[key]) prompt += `${key.replace('img', '').replace(/([A-Z])/g, ' $1')}: ${data[key]}\n`;
            });
        } else if (data.promptType === 'video') {
            prompt = `Generate a video with these specifications:\n\n`;
            Object.keys(data).filter(k => k.startsWith('vid')).forEach(key => {
                if (data[key]) prompt += `${key.replace('vid', '').replace(/([A-Z])/g, ' $1')}: ${data[key]}\n`;
            });
        }

        if (provider === 'chatgpt') prompt += `\n\nRespond in a clear, professional, and highly detailed manner.`;
        else if (provider === 'gemini') prompt += `\n\nBe creative, accurate, and think step-by-step.`;
        else if (provider === 'claude') prompt += `\n\nUse excellent reasoning and structure your response thoughtfully.`;
        else prompt += `\n\nProvide the best possible response.`;

        return prompt.trim();
    }

    function showToast(message) {
        let toast = document.getElementById('copyToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'copyToast';
            toast.style.cssText = `
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                background: #0d7a72; color: white; padding: 12px 24px; border-radius: 8px;
                font-weight: 500; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 10000;
                opacity: 0; transition: all 0.3s ease;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
        }, 1800);
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("✅ Copied to Clipboard");
        }).catch(() => {
            showToast("❌ Failed to copy");
        });
    }

    // Main Initialization
    document.addEventListener('DOMContentLoaded', () => {
        const generateBtn = document.getElementById('generateBtn');
        const outputEl = document.getElementById('output');
        const section = document.getElementById('generatedPayloadSection');
        const tokenEl = document.getElementById('tokenEstimate');

        if (generateBtn) {
            generateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const data = getFormData();
                const tokens = estimateTokens(data);

                // Update JSON output
                outputEl.textContent = JSON.stringify(data, null, 2);
                section.hidden = false;

                // Update token estimate
                tokenEl.textContent = 
                    `Estimated prompt tokens - System: ${tokens.system}, User: ${tokens.user}, Total: ${tokens.total}`;
            });
        }

        // Copy Buttons
        const copyBtns = {
            copyChatGptBtn: 'chatgpt',
            copyGeminiBtn: 'gemini',
            copyClaudeBtn: 'claude',
            copyGenericBtn: 'generic'
        };

        Object.keys(copyBtns).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    const data = getFormData();
                    const provider = copyBtns[btnId];
                    const promptText = buildPromptForProvider(provider, data);
                    copyToClipboard(promptText);
                });
            }
        });

        // Hide Claude for Image/Video
        const claudeBtn = document.getElementById('copyClaudeBtn');
        if (claudeBtn) {
            const observer = new MutationObserver(() => {
                claudeBtn.style.display = document.getElementById('promptType').value === 'text' ? 'inline-block' : 'none';
            });
            observer.observe(document.getElementById('promptType'), { attributes: true });
        }
    });
})();