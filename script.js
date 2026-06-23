/**
 * 在线考试系统主脚本
 */

// 全局变量
let questionsData = {}; // 题库数据
let currentQuestions = []; // 当前题目列表
let currentQuestionIndex = 0; // 当前题目索引
let currentQuestionType = ''; // 当前题型
let userAnswers = []; // 用户答案
let judgedAnswers = []; // 已评判的答案
let isExamMode = false; // 是否为考试模式
let isReviewMode = false; // 查看详情模式
let isPracticingWrongQuestions = false; // 是否在练习错题本中的题目
let favorites = {}; // 收藏题目
let wrongQuestions = {}; // 错题本

let practiceWrongQuestions = []; // 临时错题练习本（本次练习产生的错题）
let practiceWrongCount = 0; // 临时错题练习本数量
let isSessionWrongPractice = false; // 是否在本次错题练习中
let savedPracticeState = null; // 保存的练习状态（用于从本次错题返回）
let statistics = {
    total: 0,
    single_choice: 0,
    multiple_choice: 0,
    true_false: 0,
    fill_blank: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    correctRate: 0
}; // 统计信息
let examTimer = null; // 考试计时器
let examStartTime = null; // 考试开始时间
let examDuration = 0; // 考试总时长（分钟）
let isAnalysisVisible = false; // 答案解析是否可见

// 科目相关变量
let currentSubject = null; // 当前选择的科目
let allQuestionsData = {}; // 所有题目数据（未过滤）
let selectedSubjectOption = null; // 当前选中的科目选项
let enabledSubjects = []; // 启用的科目列表（动态加载）
let subjectsLoaded = false; // 科目是否已加载

function syncThemePermissionState(showMessage = false) {
    window.currentUser = currentUser;

    if (window.themeManager && typeof window.themeManager.syncThemeWithPermission === 'function') {
        window.themeManager.syncThemeWithPermission(showMessage);
    }
}

// 初始化系统
document.addEventListener('DOMContentLoaded', async function() {
    initParticles();
    initEventListeners();
    initResetDialogListeners();
    initPasswordToggle(); // 初始化密码切换功能
    loadStoredData();
    
    // 页面加载时确保移动端悬浮按钮隐藏
    const mobileFloatBtn = document.getElementById('mobile-favorite-float-btn');
    const mobileHomeBtn = document.getElementById('mobile-home-float-btn');
    if (mobileFloatBtn) mobileFloatBtn.style.display = 'none';
    if (mobileHomeBtn) mobileHomeBtn.style.display = 'none';
    
    await initSystem(); // 等待系统初始化完成
});

// 初始化粒子背景
function initParticles() {
    // 检查 particlesJS 是否可用
    if (typeof particlesJS === 'undefined') {

        return;
    }
    
    try {
        particlesJS('particles-js', {
            particles: {
                number: {
                    value: 80,
                    density: {
                        enable: true,
                        value_area: 800
                    }
                },
                color: {
                    value: '#ffffff'
                },
                shape: {
                    type: 'circle'
                },
                opacity: {
                    value: 0.5,
                    random: false,
                    anim: {
                        enable: false
                    }
                },
                size: {
                    value: 3,
                    random: true,
                    anim: {
                        enable: false
                    }
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#ffffff',
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: 'none',
                    random: false,
                    straight: false,
                    out_mode: 'out',
                    bounce: false
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: {
                        enable: true,
                        mode: 'grab'
                    },
                    onclick: {
                        enable: true,
                        mode: 'push'
                    },
                    resize: true
                },
                modes: {
                    grab: {
                        distance: 140,
                        line_linked: {
                            opacity: 1
                        }
                    },
                    push: {
                        particles_nb: 4
                    }
                }
            },
            retina_detect: true
        });
    } catch (error) {
     
    }
}

// 加载保存的错题本和收藏题目（按科目类型）
function loadStoredWrongQuestionsAndFavorites() {
    // 使用动态加载的科目列表，如果还未加载则使用默认科目
    let subjects = enabledSubjects.length > 0 
        ? enabledSubjects.map(s => s.name) 
        : ['毛概', '思修', '近代史', '马原']; // 默认科目

    wrongQuestions = {};
    favorites = {};

    subjects.forEach(subject => {
        const wrongKey = `exam_wrong_questions_${subject}`;
        const favKey = `exam_favorites_${subject}`;

        const wrongQuestionsJson = localStorage.getItem(wrongKey);
        if (wrongQuestionsJson) {
            wrongQuestions[subject] = JSON.parse(wrongQuestionsJson);
        } else {
            // 确保默认结构存在
            wrongQuestions[subject] = {
                'single_choice': [],
                'multiple_choice': [],
                'true_false': [],
                'fill_blank': []
            };
        }

        const favoritesJson = localStorage.getItem(favKey);
        if (favoritesJson) {
            favorites[subject] = JSON.parse(favoritesJson);
        } else {
            // 确保默认结构存在
            favorites[subject] = {
                'single_choice': [],
                'multiple_choice': [],
                'true_false': [],
                'fill_blank': []
            };
        }
    });
}

// 在 initSystem 中调用加载函数
async function initSystem() {
    showLoading('正在初始化系统...');
    
    try {
        // 初始化LeanCloud
        const initResult = await window.leanCloudClient.init();
        if (!initResult.success) {
            throw new Error(initResult.message);
        }
        
        updateStatus('已连接服务器', 'connected');
        
        // 加载启用的科目列表
        await loadEnabledSubjects();
        
        // 加载科目映射（从 SubjectAPI 获取）
        await loadSubjectCategories();
        
        // 加载题目数据
        await loadQuestionsFromCloud();
        
        // 加载保存的错题本和收藏题目
        loadStoredWrongQuestionsAndFavorites();

        // 从已加载的题库数据中计算统计信息，不再单独请求
        calculateStatisticsFromData();
        
        // 更新UI
        updateUI();
        
        hideLoading();
        showMessage('系统初始化成功！', 'success');
        
    } catch (error) {
        console.error('系统初始化失败:', error);
        updateStatus('服务器连接异常', 'error');
        hideLoading();
        showMessage('系统初始化失败: ' + error.message, 'error');
    }
}

// 初始化事件监听器
function initEventListeners() {
    // 登录检查函数
    function requireLogin(callback) {
        if (!currentUser) {
            // 用户未登录，显示登录提示弹窗
            if (window.showLoginRequiredModal) {
                window.showLoginRequiredModal();
            }
            return false;
        }
        // 用户已登录，执行回调函数
        callback();
        return true;
    }

    // 题型按钮事件（需要登录和会员状态检查）
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            requireLogin(async () => {
                await withMembershipCheck(async () => await handleTypeButtonClick(e), '进入练习模式');
            });
        });
    });
    
    // 模拟考试按钮（需要登录和会员状态检查）
    document.getElementById('mock-exam-btn').addEventListener('click', async () => {
        requireLogin(async () => {
            await withMembershipCheck(showExamConfigModal, '开始模拟考试');
        });
    });

    // 个人中心按钮（需要登录和会员状态检查）
    document.getElementById('favorites-btn').addEventListener('click', async () => {
        requireLogin(async () => {
            await withMembershipCheck(showFavoritesModal, '查看收藏夹');
        });
    });
    document.getElementById('wrong-questions-btn').addEventListener('click', async () => {
        requireLogin(async () => {
            await withMembershipCheck(showWrongQuestionsModal, '查看错题本');
        });
    });

    // 题目导航事件
    document.getElementById('prev-btn').addEventListener('click', previousQuestion);
    document.getElementById('next-btn').addEventListener('click', nextQuestion);
    document.getElementById('submit-btn').addEventListener('click', submitAnswer);
    
    // 收藏按钮（需要登录）
    document.getElementById('favorite-btn').addEventListener('click', () => {
        requireLogin(toggleFavorite);
    });

    // 重置记录按钮
    document.getElementById('reset-records-btn').addEventListener('click', () => {
        showResetRecordsConfirmModal();
    });
    // 返回主页按钮（会员状态检查）
    document.getElementById('home-btn').addEventListener('click', async () => {
        if (currentUser) {
            await withMembershipCheck(returnToHome, '返回主页');
        } else {
            returnToHome();
        }
    });

    // 用户系统事件（会员状态检查）
    document.getElementById('user-center-btn').addEventListener('click', async () => {
        if (currentUser) {
            // 检查会员状态并触发会话检测
            if (currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip' || currentUser.membershipType === 'sssvip') {
                const sessionCheckResult = await triggerSessionCheck('打开个人中心');
                if (!sessionCheckResult.success) {
                    return; // 会话过期时不继续执行
                }
            }
            await withMembershipCheck(showUserCenterModal, '打开个人中心');
        } else {
            showUserCenterModal();
        }
    });
    document.getElementById('close-auth').addEventListener('click', hideAuthModal);
    document.getElementById('close-user-center').addEventListener('click', hideUserCenterModal);
    document.getElementById('login-register-btn').addEventListener('click', showAuthModal);
    
    // 科目选择相关事件
    document.getElementById('subject-selector-btn').addEventListener('click', handleSubjectSelectorClick);
    document.getElementById('close-subject-selector').addEventListener('click', hideSubjectSelectorModal);
    document.getElementById('confirm-subject-selection').addEventListener('click', async () => await confirmSubjectSelection());
    
    // 修改密码相关事件
    document.getElementById('change-password-btn').addEventListener('click', showChangePasswordModal);
    document.getElementById('close-change-password').addEventListener('click', hideChangePasswordModal);
    document.getElementById('cancel-change-password').addEventListener('click', hideChangePasswordModal);
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    
    // 修改用户名相关事件
    document.getElementById('edit-username-btn').addEventListener('click', showEditUsernameModal);
    document.getElementById('close-edit-username').addEventListener('click', hideEditUsernameModal);
    document.getElementById('cancel-edit-username').addEventListener('click', hideEditUsernameModal);
    document.getElementById('edit-username-form').addEventListener('submit', handleEditUsername);
    
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
    document.getElementById('show-forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        showForgotPasswordModal();
    });
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('send-code-btn').addEventListener('click', handleSendVerificationCode);
    
    // 忘记密码相关事件
    document.getElementById('close-forgot-password').addEventListener('click', hideForgotPasswordModal);
    document.getElementById('cancel-forgot-password').addEventListener('click', hideForgotPasswordModal);
    document.getElementById('send-reset-code-btn').addEventListener('click', handleSendResetCode);
    document.getElementById('forgot-password-form').addEventListener('submit', handleResetPassword);
    
    // 邮箱组合功能
    document.getElementById('register-username').addEventListener('input', updateEmailAddress);
    document.getElementById('email-domain').addEventListener('change', updateEmailAddress);
    

    
    // 会员系统事件
    document.getElementById('membership-btn').addEventListener('click', showMembershipModal);
    
    // 数据导入和同步（需要登录）
    document.getElementById('import-data-btn').addEventListener('click', () => {
        requireLogin(importDataFromCloud);
    });
    document.getElementById('sync-data-btn').addEventListener('click', () => {
        requireLogin(syncDataToCloud);
    });
    
    // CDK激活按钮事件
    document.getElementById('activate-cdk-btn').addEventListener('click', handleCDKActivation);
    
    // 联系官方按钮事件 - 滚动到会员弹窗底部
    document.getElementById('contact-official-btn').addEventListener('click', () => {
        scrollMembershipModalToBottom();
    });
    
    // 通用关闭按钮事件（通过data-modal属性）
    document.querySelectorAll('.close-btn[data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.getAttribute('data-modal');
            hideMembershipModal(modalId);
        });
    });

    // 模拟考试配置模态框事件
    document.getElementById('close-exam-config').addEventListener('click', hideExamConfigModal);
    document.getElementById('cancel-exam-config').addEventListener('click', hideExamConfigModal);
    document.getElementById('start-exam').addEventListener('click', startConfiguredExam);
    
    // 考试面板切换事件
    document.querySelectorAll('.exam-tab').forEach(tab => {
        tab.addEventListener('click', () => switchExamTab(tab.dataset.tab));
    });
    
    // 清空考试记录事件
    document.getElementById('clear-exam-history').addEventListener('click', clearExamHistory);

    // 错题本模态框事件
    document.getElementById('close-wrong-questions').addEventListener('click', hideWrongQuestionsModal);
    document.getElementById('wrong-type-filter').addEventListener('change', filterWrongQuestions);
    document.getElementById('clear-wrong-questions').addEventListener('click', clearWrongQuestions);
    
    // 错题本批量练习事件
    document.getElementById('practice-all-wrong').addEventListener('click', practiceAllWrongQuestions);
    document.getElementById('practice-wrong-by-type').addEventListener('click', practiceWrongQuestionsByType);

    // 收藏模态框事件
    document.getElementById('close-favorites').addEventListener('click', hideFavoritesModal);
    document.getElementById('favorite-type-filter').addEventListener('change', filterFavorites);
    document.getElementById('clear-favorites').addEventListener('click', clearFavorites);
    
    // 收藏批量练习事件
    document.getElementById('practice-all-favorites').addEventListener('click', practiceAllFavorites);
    document.getElementById('practice-favorites-by-type').addEventListener('click', practiceFavoritesByType);


    // 考试配置输入事件
    ['single-count-input', 'multiple-count-input', 'judge-count-input', 'fill-count-input'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateExamSummary);
    });

    // 点击模态框外部关闭
    // 交卷相关事件
   
    // 注意：nav-submit-exam-btn 的事件监听器在 updateExamNavigation 中动态绑定
    document.getElementById('cancel-submit').addEventListener('click', hideSubmitConfirmModal);
    document.getElementById('confirm-submit').addEventListener('click', submitExam);
    document.getElementById('return-home').addEventListener('click', () => {
        hideExamResultModal();
        returnToHome();
    });
    document.getElementById('review-exam').addEventListener('click', reviewExamDetails);

    // 题号选择模态框关闭事件
    document.getElementById('close-question-number-modal').addEventListener('click', hideQuestionNumberModal);
    
    // 题目导航中的本次错题练习按钮事件
    document.getElementById('nav-session-wrong-btn').addEventListener('click', startSessionWrongPractice);
    
    // 修改模态框外部点击关闭逻辑，添加遮罩层阻止点击
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // 检查是否是必须选择的模态框
                if (modal.hasAttribute('data-required')) {
                    return; // 必须选择时不允许点击外部关闭
                }
                // 检查是否允许点击外部关闭（通过data-closeable属性控制）
                if (modal.hasAttribute('data-closeable') && modal.getAttribute('data-closeable') === 'false') {
                    // 对于考试题目数超限提示模态框，允许点击外部关闭
                    if (modal.id !== 'exam-limit-modal') {
                        return; // 不允许点击外部关闭
                    }
                }
                modal.classList.add('hidden');
                // 关闭模态框时移除页面滚动限制
                document.body.classList.remove('modal-open');
            }
        });
    });
    
    // 考试题目数超限提示模态框事件
    // 考试题目数超限提示模态框事件
    document.getElementById('exam-limit-ok').addEventListener('click', function() {
        document.getElementById('exam-limit-modal').classList.add('hidden');
    });
    
    // 移动端底部导航栏事件
    initMobileBottomNav();
}

// 初始化移动端底部导航栏
function initMobileBottomNav() {
    const mobileHomeBtn = document.getElementById('mobile-home-btn');
    const mobileSubjectBtn = document.getElementById('mobile-subject-btn');
    const mobileWrongBtn = document.getElementById('mobile-wrong-btn');
    const mobileFavoritesBtn = document.getElementById('mobile-favorites-btn');
    const mobileUserBtn = document.getElementById('mobile-user-btn');
    
    // 复用桌面端按钮的点击事件
    if (mobileHomeBtn) {
        mobileHomeBtn.addEventListener('click', () => {
            document.getElementById('home-btn').click();
        });
    }
    
    if (mobileSubjectBtn) {
        mobileSubjectBtn.addEventListener('click', () => {
            document.getElementById('subject-selector-btn').click();
        });
    }
    
    if (mobileWrongBtn) {
        mobileWrongBtn.addEventListener('click', () => {
            document.getElementById('wrong-questions-btn').click();
        });
    }
    
    if (mobileFavoritesBtn) {
        mobileFavoritesBtn.addEventListener('click', () => {
            document.getElementById('favorites-btn').click();
        });
    }
    
    if (mobileUserBtn) {
        mobileUserBtn.addEventListener('click', () => {
            document.getElementById('user-center-btn').click();
        });
    }
    
    // 移动端悬浮收藏按钮
    const mobileFloatFavoriteBtn = document.getElementById('mobile-favorite-float-btn');
    if (mobileFloatFavoriteBtn) {
        mobileFloatFavoriteBtn.addEventListener('click', () => {
            const originalBtn = document.getElementById('favorite-btn');
            if (originalBtn) {
                originalBtn.click();
            }
        });
    }
    
    // 移动端悬浮返回/交卷按钮
    const mobileFloatHomeBtn = document.getElementById('mobile-home-float-btn');
    if (mobileFloatHomeBtn) {
        mobileFloatHomeBtn.addEventListener('click', () => {
            if (isExamMode && !isReviewMode) {
                // 考试模式下点击交卷
                const submitBtn = document.getElementById('nav-submit-exam-btn');
                if (submitBtn) {
                    submitBtn.click();
                }
            } else {
                // 非考试模式下返回首页
                const homeBtn = document.getElementById('home-btn');
                if (homeBtn) {
                    homeBtn.click();
                }
            }
        });
    }
    
    // 答案解析悬浮按钮
    const analysisFloatBtn = document.getElementById('analysis-float-btn');
    if (analysisFloatBtn) {
        analysisFloatBtn.addEventListener('click', toggleAnalysis);
    }
    
    // 桌面端背题按钮
    const analysisDesktopBtn = document.getElementById('analysis-btn');
    if (analysisDesktopBtn) {
        analysisDesktopBtn.addEventListener('click', toggleAnalysis);
    }
}

// 显示/隐藏移动端悬浮收藏按钮
function toggleMobileFavoriteButton(show) {
    if (window.innerWidth <= 768) {
        const mobileFloatBtn = document.getElementById('mobile-favorite-float-btn');
        const mobileHomeBtn = document.getElementById('mobile-home-float-btn');
        const analysisFloatBtn = document.getElementById('analysis-float-btn');
        
        // 在首页时强制隐藏
        const questionSection = document.getElementById('question-section');
        const isOnHomePage = questionSection && questionSection.classList.contains('hidden');
        
        if (isOnHomePage) {
            // 首页：强制隐藏所有悬浮按钮
            if (mobileFloatBtn) {
                mobileFloatBtn.style.display = 'none';
                mobileFloatBtn.style.setProperty('display', 'none', 'important');
            }
            if (mobileHomeBtn) {
                mobileHomeBtn.style.display = 'none';
                mobileHomeBtn.style.setProperty('display', 'none', 'important');
            }
            if (analysisFloatBtn) {
                analysisFloatBtn.style.display = 'none';
                analysisFloatBtn.style.setProperty('display', 'none', 'important');
            }
            return;
        }
        
        if (mobileFloatBtn) {
            if (show) {
                mobileFloatBtn.style.display = 'flex';
            } else {
                mobileFloatBtn.style.display = 'none';
            }
        }
        
        if (mobileHomeBtn) {
            if (show) {
                mobileHomeBtn.style.display = 'flex';
            } else {
                mobileHomeBtn.style.display = 'none';
            }
            
            // 根据模式更新按钮样式和图标
            if (show) {
                const icon = mobileHomeBtn.querySelector('i');
                const text = mobileHomeBtn.querySelector('span');
                if (isExamMode && !isReviewMode) {
                    // 考试模式：红色交卷按钮
                    mobileHomeBtn.classList.add('exam-mode');
                    if (icon) icon.className = 'fas fa-paper-plane';
                    if (text) text.textContent = '交卷';
                } else {
                    // 练习模式：蓝色返回按钮
                    mobileHomeBtn.classList.remove('exam-mode');
                    if (icon) icon.className = 'fas fa-home';
                    if (text) text.textContent = '首页';
                }
            }
        }
        
        // 处理背题按钮的显示逻辑
        if (analysisFloatBtn) {
            // 检查是否已经评题（与showQuestion中的逻辑保持一致）
            const isJudged = judgedAnswers[currentQuestionIndex] && (!isExamMode || isReviewMode);
            
            // 背题模式下保持显示关闭按钮；其他情况下仅在未评题且非考试模式时显示
            if (!show || isExamMode) {
                analysisFloatBtn.style.display = 'none';
            } else if (isAnalysisVisible) {
                analysisFloatBtn.style.display = 'flex';
            } else if (isJudged) {
                analysisFloatBtn.style.display = 'none';
            } else {
                // 未评题且非考试模式，显示背题按钮
                analysisFloatBtn.style.display = 'flex';
            }
        }
    }
}

// 切换答案解析显示/隐藏
function toggleAnalysis() {
    const analysisFloatBtn = document.getElementById('analysis-float-btn');
    const analysisDesktopBtn = document.getElementById('analysis-btn');
    const feedbackElement = document.getElementById('answer-feedback');
    
    if (!currentQuestions || currentQuestions.length === 0 || currentQuestionIndex >= currentQuestions.length) {
        return;
    }
    
    const currentQuestion = currentQuestions[currentQuestionIndex];
    
    if (isAnalysisVisible) {
        // 隐藏解析
        hideAnalysis();
    } else {
        // 显示解析
        showAnalysis(currentQuestion);
    }
}

// 显示答案解析
function showAnalysis(question) {
    const analysisBtn = document.getElementById('analysis-float-btn');
    const feedbackElement = document.getElementById('answer-feedback');
    const correctAnswerElement = document.getElementById('correct-answer');
    const explanationElement = document.getElementById('explanation');
    const feedbackResult = document.getElementById('feedback-result');
    const questionSection = document.getElementById('question-section');
    
    // 隐藏评题结果（回答正确/错误）
    if (feedbackResult) {
        feedbackResult.style.display = 'none';
    }
    
    // 显示解析内容
    if (correctAnswerElement && question.correctAnswer) {
        correctAnswerElement.innerHTML = `<strong>正确答案：</strong>${question.correctAnswer}`;
        correctAnswerElement.style.display = 'block';
    }
    
    if (explanationElement && question.explanation) {
        explanationElement.innerHTML = `<strong>解析：</strong>${question.explanation}`;
        explanationElement.style.display = 'block';
    }
    
    // 显示反馈区域
    if (feedbackElement) {
        feedbackElement.classList.remove('hidden');
        // 添加高亮动画效果
        feedbackElement.style.animation = 'highlightAnalysis 1s ease-out';
        setTimeout(() => {
            feedbackElement.style.animation = '';
        }, 1000);
    }
    
    // 显示正确答案为绿色（像评题结果一样）
    showCorrectAnswerOptions(question);
    
    // 更新按钮状态
    const analysisFloatBtn = document.getElementById('analysis-float-btn');
    const analysisDesktopBtn = document.getElementById('analysis-btn');
    
    if (analysisFloatBtn) {
        analysisFloatBtn.classList.add('active');
        const icon = analysisFloatBtn.querySelector('i');
        const text = analysisFloatBtn.querySelector('span');
        if (icon) icon.className = 'fas fa-times';
        if (text) text.textContent = '关闭';
    }
    
    if (analysisDesktopBtn) {
        analysisDesktopBtn.classList.add('active');
        const icon = analysisDesktopBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-times';
    }
    
    // 禁用做题功能
    disableQuestionInteraction();
    
    // 滑动到解析位置
    setTimeout(() => {
        if (feedbackElement) {
            feedbackElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, 100);
    
    // 标记解析为可见
    isAnalysisVisible = true;
}

// 显示正确答案选项（绿色高亮）
function showCorrectAnswerOptions(question) {
    // 批量练习模式或考试模式下使用题目自带的类型，否则使用当前题型
    const questionType = (isExamMode || window.isBatchPractice) ? (question._type || currentQuestionType) : currentQuestionType;
    const correctAnswer = question.correctAnswer.trim().toUpperCase();
    
    if (questionType === 'single_choice' || questionType === 'multiple_choice') {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            const optionMarker = option.querySelector('.option-marker');
            const optionText = option.querySelector('.option-text');
            if (optionMarker && optionText) {
                const optionLetter = optionMarker.textContent.trim().toUpperCase();
                // 检查是否是正确答案
                if (questionType === 'single_choice' && optionLetter === correctAnswer) {
                    option.classList.add('correct');
                } else if (questionType === 'multiple_choice') {
                    // 多选题：检查选项字母是否在正确答案中
                    if (correctAnswer.includes(optionLetter)) {
                        option.classList.add('correct');
                    }
                }
            }
        });
    } else if (questionType === 'true_false') {
        const options = document.querySelectorAll('.option');
        options.forEach((option, index) => {
            // 判断题：A=正确，B=错误
            const isCorrect = (correctAnswer === 'A' && index === 0) || (correctAnswer === 'B' && index === 1);
            if (isCorrect) {
                option.classList.add('correct');
            }
        });
    }
}

// 隐藏答案解析
function hideAnalysis() {
    const analysisBtn = document.getElementById('analysis-float-btn');
    const feedbackElement = document.getElementById('answer-feedback');
    const feedbackResult = document.getElementById('feedback-result');
    const questionSection = document.getElementById('question-section');
    
    // 隐藏反馈区域
    if (feedbackElement) {
        feedbackElement.classList.add('hidden');
    }
    
    // 恢复评题结果显示
    if (feedbackResult) {
        feedbackResult.style.display = '';
    }
    
    // 恢复按钮状态
    const analysisFloatBtn = document.getElementById('analysis-float-btn');
    const analysisDesktopBtn = document.getElementById('analysis-btn');
    
    if (analysisFloatBtn) {
        analysisFloatBtn.classList.remove('active');
        const icon = analysisFloatBtn.querySelector('i');
        const text = analysisFloatBtn.querySelector('span');
        if (icon) icon.className = 'fas fa-lightbulb';
        if (text) text.textContent = '背题';
    }
    
    if (analysisDesktopBtn) {
        analysisDesktopBtn.classList.remove('active');
        const icon = analysisDesktopBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-lightbulb';
    }
    
    // 清除正确答案的绿色高亮
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.classList.remove('correct');
    });
    
    // 启用做题功能
    enableQuestionInteraction();
    
    // 滑动到题目顶部
    setTimeout(() => {
        if (questionSection) {
            questionSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }, 100);
    
    // 标记解析为不可见
    isAnalysisVisible = false;
}

// 禁用题目交互（做题和评题功能）
function disableQuestionInteraction() {
    // 禁用选项点击但保持正常样式
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.style.pointerEvents = 'none';
        // 不设置透明度，保持正常显示
    });
    
    // 禁用输入框但保持正常样式
    const answerInput = document.getElementById('answer-input');
    if (answerInput) {
        answerInput.disabled = true;
        // 不设置透明度，保持正常显示
    }
    
    // 禁用提交按钮但保持正常样式
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        // 不设置透明度，保持正常显示
    }
    
    // 不禁用上一题/下一题按钮，背题模式下也允许直接切题
}

// 启用题目交互（做题和评题功能）
function enableQuestionInteraction() {
    // 启用选项点击
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.style.pointerEvents = 'auto';
        option.style.opacity = '1';
    });
    
    // 启用输入框
    const answerInput = document.getElementById('answer-input');
    if (answerInput) {
        answerInput.disabled = false;
        answerInput.style.opacity = '1';
    }
    
    // 启用提交按钮
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
    }
    
    // 上一题/下一题按钮保持启用状态（之前就没有禁用）
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) {
        prevBtn.disabled = false;
        prevBtn.style.opacity = '1';
    }
    if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
    }
}

// 加载启用的科目列表
async function loadEnabledSubjects() {
    try {
        // 从 LeanCloud 客户端获取启用的科目
        if (window.leanCloudClient && window.leanCloudClient.enabledSubjects) {
            enabledSubjects = window.leanCloudClient.enabledSubjects;
            subjectsLoaded = true;
        
            
            // 动态渲染科目选择器
            renderSubjectSelector();
            
            return { success: true, data: enabledSubjects };
        } else {
            throw new Error('无法获取科目列表');
        }
    } catch (error) {

        // 降级方案：使用默认科目
        enabledSubjects = [
            { 
                id: 'maogai', 
                name: '毛概', 
                displayName: '毛泽东思想概论', 
                icon: '🏛️', 
                description: '',
                order: 1,
                isDefault: true, 
                isEnabled: true,
                questionCollection: 'Question_MaoGai' 
            },
            { 
                id: 'sixiu', 
                name: '思修', 
                displayName: '思想道德修养', 
                icon: '💭', 
                description: '',
                order: 2,
                isDefault: true, 
                isEnabled: true,
                questionCollection: 'Question_SiXiu' 
            },
            { 
                id: 'jindaishi', 
                name: '近代史', 
                displayName: '中国近现代史纲要', 
                icon: '📜', 
                description: '',
                order: 3,
                isDefault: true, 
                isEnabled: true,
                questionCollection: 'Question_JinDaiShi' 
            },
            { 
                id: 'mayuan', 
                name: '马原', 
                displayName: '马克思主义基本原理', 
                icon: '⚡', 
                description: '',
                order: 4,
                isDefault: true, 
                isEnabled: true,
                questionCollection: 'Question_MaYuan' 
            }
        ];
        subjectsLoaded = true;
        renderSubjectSelector();
        return { success: false, message: error.message };
    }
}

// 动态渲染科目选择器
function renderSubjectSelector() {
    const container = document.querySelector('.subject-options');
    if (!container) {
   
        return;
    }
    
    // 清空现有内容
    container.innerHTML = '';
    
    // 渲染每个启用的科目
    enabledSubjects.forEach(subject => {
        const option = document.createElement('div');
        option.className = 'subject-option';
        option.setAttribute('data-subject', JSON.stringify(subject));
        
        // 使用默认图标或通用图标
        const icon = subject.icon || '📚';
        
        option.innerHTML = `
            <div class="subject-icon">${icon}</div>
            <div class="subject-info">
                <h3>${subject.name}</h3>
                <p>${subject.displayName || subject.name}</p>
            </div>
        `;
        
        // 添加点击事件
        option.addEventListener('click', function() {
            // 移除其他选项的选中状态
            document.querySelectorAll('.subject-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            // 添加当前选项的选中状态
            option.classList.add('selected');
            selectedSubjectOption = subject;
        });
        
        container.appendChild(option);
    });
    

}

// 从云端加载题目数据
async function loadQuestionsFromCloud() {
    try {
        showLoading('正在加载数据...');

        if (!enabledSubjects || enabledSubjects.length === 0) {
            await loadEnabledSubjects();
        }

        const resolvedSubject = getMatchedEnabledSubject(currentSubject) || loadCurrentSubject();

        // 只加载当前选中的科目的题目（减少请求）
        let result;
        if (resolvedSubject && resolvedSubject.name) {
            currentSubject = resolvedSubject;
            result = await window.leanCloudClient.getCurrentSubjectQuestions(resolvedSubject);
            if (!result.success) {
                throw new Error(result.message);
            }
            allQuestionsData = result.data;
        } else {
            // 降级处理，使用空数据
            allQuestionsData = {
                single_choice: [],
                multiple_choice: [],
                true_false: [],
                fill_blank: []
            };
        }
        
        // 题目已经按科目加载，直接使用
        questionsData = { ...allQuestionsData };

        updateStatus('已连接服务器', 'connected');
        
        // 立即从加载的数据中计算统计信息，避免后续的重复计算和请求
        calculateStatisticsFromData();
        
    } catch (error) {

        throw error;
    }
}

// 从已加载的题库数据中计算统计信息，避免额外的数据库请求
function calculateStatisticsFromData() {
    try {
        // 从本地题库数据计算各题型数量
        const singleChoiceCount = questionsData.single_choice ? questionsData.single_choice.length : 0;
        const multipleChoiceCount = questionsData.multiple_choice ? questionsData.multiple_choice.length : 0;
        const trueFalseCount = questionsData.true_false ? questionsData.true_false.length : 0;
        const fillBlankCount = questionsData.fill_blank ? questionsData.fill_blank.length : 0;
        const totalCount = singleChoiceCount + multipleChoiceCount + trueFalseCount + fillBlankCount;
        
      
        
        // 更新全局统计对象
        statistics.total = totalCount;
        statistics.single_choice = singleChoiceCount;
        statistics.multiple_choice = multipleChoiceCount;
        statistics.true_false = trueFalseCount;
        statistics.fill_blank = fillBlankCount;
        
        // 保留用户答题统计（从本地存储获取）
        const userStats = getUserStatistics();
        statistics.totalAnswered = userStats.total || 0;
        statistics.totalCorrect = userStats.correct || 0;
        statistics.correctRate = userStats.correctRate || 0;

            updateStatisticsDisplay();
    } catch (error) {
        console.error('计算统计信息失败:', error);
    }
}

// 保留原函数但不再使用云端请求（仅用于用户登录后的特殊情况）
async function loadStatistics() {
    try {
        // 优先从本地数据计算，避免额外的数据库请求
        calculateStatisticsFromData();
        
        // 注释掉云端请求部分以提高性能
        // const result = await window.leanCloudClient.getStatistics();
        // if (result.success) {
        //     statistics = result.data;
        //     updateStatisticsDisplay();
        // }
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

// 更新主页用户信息显示
function updateStatisticsDisplay() {
    // 从localStorage读取用户信息（优先使用全局currentUser，若无则从localStorage读取）
    let user = currentUser;
    if (!user) {
        const examUserStr = localStorage.getItem('examUser');
        if (examUserStr) {
            try {
                user = JSON.parse(examUserStr);
            } catch (e) {
                console.warn('解析examUser失败:', e);
            }
        }
    }
    
    // 更新用户信息
    if (user) {
        // 用户名
        document.getElementById('home-username').textContent = user.username || '未知用户';
        
        // 会员类型
        const membershipType = user.membershipType || '非会员';
        const membershipElement = document.getElementById('home-membership-type');
        membershipElement.textContent = membershipType;
        
        // 根据会员类型设置颜色
        if (membershipType === 'sssvip') {
            membershipElement.style.color = '#a63ad1ff';
            membershipElement.style.fontWeight = 'bold';
        } else if (membershipType === 'svip') {
            membershipElement.style.color = '#dd1c1cff';
            membershipElement.style.fontWeight = 'bold';
        } else if (membershipType === 'vip') {
            membershipElement.style.color = '#ffd900ff';
            membershipElement.style.fontWeight = 'bold';
        } else {
            membershipElement.style.color = '';
            membershipElement.style.fontWeight = '';
        }
        
        // 到期时间
        const expiryElement = document.getElementById('home-membership-expiry');
        if (membershipType === 'sssvip') {
            expiryElement.textContent = '永久有效';
            expiryElement.style.color = '#ff6b6b';
        } else if (user.membershipEndTime) {
            const endDate = new Date(user.membershipEndTime);
            expiryElement.textContent = endDate.toLocaleDateString('zh-CN');
            
            // 检查是否即将过期（7天内）
            const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 0) {
                expiryElement.style.color = '#ef4444';
            } else if (daysLeft <= 7) {
                expiryElement.style.color = '#f59e0b';
            } else {
                expiryElement.style.color = '';
            }
        } else {
            expiryElement.textContent = '--';
            expiryElement.style.color = '';
        }
    } else {
        // 未登录状态
        document.getElementById('home-username').textContent = '未登录';
        document.getElementById('home-membership-type').textContent = '非会员';
        document.getElementById('home-membership-expiry').textContent = '--';
    }
    
    // 当前科目题目数
    const subjectQuestionsElement = document.getElementById('home-subject-questions');
    if (statistics && statistics.total) {
        subjectQuestionsElement.textContent = statistics.total + ' 题';
    } else {
        subjectQuestionsElement.textContent = '--';
    }
    
    // 使用已计算的统计数据更新题型按钮上的题目数量
    document.getElementById('single-count').textContent = (statistics.single_choice || 0) + ' 题';
    document.getElementById('multiple-count').textContent = (statistics.multiple_choice || 0) + ' 题';
    document.getElementById('judge-count').textContent = (statistics.true_false || 0) + ' 题';
    document.getElementById('fill-count').textContent = (statistics.fill_blank || 0) + ' 题';
}

// 获取用户统计信息
function getUserStatistics() {
    const stats = JSON.parse(localStorage.getItem('exam_user_stats') || '{}');
    return {
        correct: stats.correct || 0,
        total: stats.total || 0,
        correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    };
}

// 更新答题统计信息
function updateAnswerStatistics(isCorrect) {
    // 更新本地 exam_user_stats
    const stats = getUserStatistics();
    stats.total += 1;
    if (isCorrect) {
        stats.correct += 1;
    }
    stats.correctRate = Math.round((stats.correct / stats.total) * 100);
    localStorage.setItem('exam_user_stats', JSON.stringify(stats));
    
    // 更新全局 statistics 对象
    if (!statistics) {
        statistics = {};
    }
    
    // 只更新用户答题统计，保留题库统计信息
    statistics.totalAnswered = stats.total;
    statistics.totalCorrect = stats.correct;
    statistics.correctRate = stats.correctRate;
    
    // 如果题库统计信息丢失，重新计算
    if (!statistics.total && questionsData && Object.keys(questionsData).length > 0) {
      
        const singleChoiceCount = questionsData.single_choice ? questionsData.single_choice.length : 0;
        const multipleChoiceCount = questionsData.multiple_choice ? questionsData.multiple_choice.length : 0;
        const trueFalseCount = questionsData.true_false ? questionsData.true_false.length : 0;
        const fillBlankCount = questionsData.fill_blank ? questionsData.fill_blank.length : 0;
        const totalCount = singleChoiceCount + multipleChoiceCount + trueFalseCount + fillBlankCount;
        
        statistics.total = totalCount;
        statistics.single_choice = singleChoiceCount;
        statistics.multiple_choice = multipleChoiceCount;
        statistics.true_false = trueFalseCount;
        statistics.fill_blank = fillBlankCount;
    }
    
    // 如果用户已登录，同步更新云端用户的 statistics
    if (currentUser) {
        currentUser.statistics = statistics;
        currentUser.userStats = stats;
        localStorage.setItem('examUser', JSON.stringify(currentUser));
    }
    
    updateStatisticsDisplay();
}

// 检查用户是否已登录
function requireLogin(actionName = '使用此功能') {
    if (!currentUser) {
        showLoginRequiredModal(actionName);
        return false;
    }
    return true;
}

// 检查用户是否为会员
function requireMembership(actionName = '使用此功能') {
    if (!currentUser) {
        showLoginRequiredModal(actionName);
        return false;
    }
    
    if (!currentUser.membershipType || currentUser.membershipType === '非会员') {
        showMembershipRequiredModal(actionName);
        return false;
    }
    
    // 检查会员是否过期（sssvip永不过期）
    if (currentUser.membershipType !== 'sssvip' && currentUser.membershipEndTime) {
        const now = new Date();
        const endTime = new Date(currentUser.membershipEndTime);
        if (now > endTime) {
            // 检测到过期，不显示重复的提示，让checkCurrentUserMembershipStatus统一处理
            // 异步触发过期处理，不阻塞当前流程
            checkCurrentUserMembershipStatus().catch(error => {
                console.error('后台过期处理失败:', error);
            });
            return false;
        }
    }
    
    return true;
}

// 删除重复的checkMembershipExpiry函数，过期检查现在统一在leancloud-client.js中处理

// 检查当前用户会员状态（用于操作前校验）
async function checkCurrentUserMembershipStatus() {
    // 如果用户未登录，无需检查
    if (!currentUser) {
        return { needsAction: false, message: '用户未登录' };
    }
    
    // 检查当前用户是否过期
    const isExpired = (currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip') && 
                      currentUser.membershipEndTime && 
                      new Date() > new Date(currentUser.membershipEndTime);
    
    if (isExpired) {
        
        try {
            // 立即显示过期确认弹窗（与小程序的逻辑保持一致）
            const userChoice = await showMembershipExpiredConfirmModal();
            
            if (userChoice.action === 'later') {
                // 用户选择稍后处理，返回但标记需要处理
                return { 
                    needsAction: true, 
                    message: '会员已过期，请尽快处理。',
                    action: 'expired_pending'
                };
            } else if (userChoice.action === 'upgrade') {
                // 用户选择升级会员
                return { 
                    needsAction: true, 
                    message: '正在跳转到会员升级页面...',
                    action: 'upgrade'
                };
            }
        } catch (error) {
            console.error('处理会员过期时发生错误:', error);
            await handleLogout();
            return { 
                needsAction: true, 
                message: '会员状态检查失败，请重新登录。',
                action: 'logout'
            };
        }
    }
    
    return { needsAction: false, message: '会员状态正常' };
}

// 包装函数：在执行关键操作前检查会员状态
async function withMembershipCheck(callback, actionName = '执行操作') {
    // 检查会员状态
    const statusCheck = await checkCurrentUserMembershipStatus();
    
    if (statusCheck.needsAction) {
        // 如果需要处理会员过期或退出登录，不执行原操作
        if (statusCheck.action === 'logout') {
            showMessage(statusCheck.message, 'error');
            // 不执行原操作
            return false;
        } else if (statusCheck.action === 'expired_pending') {
            showMessage(statusCheck.message, 'warning');
            // 不执行原操作
            return false;
        } else if (statusCheck.action === 'upgrade') {
            showMessage(statusCheck.message, 'info');
            // 不执行原操作
            return false;
        }
    } else {
        // 会员状态正常，执行原操作
        if (typeof callback === 'function') {
            callback();
        }
    }
    
    return true;
}

// 处理会员过期：清理本地数据并强制重新登录
async function handleMembershipExpiry(user, showNotification = true) {
    
    try {
        // 1. 更新云端用户数据：降级为非会员（保留其他数据）
        const updateResult = await window.leanCloudClient.handleMembershipExpiry(user.objectId);
        
        if (!updateResult.success) {
            console.error('云端会员状态更新失败:', updateResult.message);
            throw new Error('云端会员状态更新失败');
        }
        
        
        // 2. 清理本地存储（保留examUser）
        clearLocalStorageExceptUser();
        
        // 3. 强制退出登录
        await handleLogout();
        

        
        // 4. 根据参数决定是否显示过期提示
        if (showNotification) {
            showMembershipExpiredLoginNotification();
        }
        
        return true;
        
    } catch (error) {
        console.error('会员过期处理失败:', error);
        showMessage('会员状态处理异常，请重新登录', 'error');
        // 即使处理失败，也要强制退出登录
        await handleLogout();
        return false;
    }
}

// 清理学习相关的本地数据（与小程序的clearLocalLearningData保持一致）
function clearLocalLearningData() {
    try {
        // 获取所有存储键
        const allStorageKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            allStorageKeys.push(localStorage.key(i));
        }
        
        const keysToRemove = [];
        
        allStorageKeys.forEach(key => {
            // 清理进度、错题、收藏等学习数据（与小程序的逻辑保持一致）
            if (key.startsWith('practice_progress_') ||
                key.startsWith('exam_wrong_questions_') ||
                key.startsWith('exam_favorites_') ||
                key.startsWith('exam_question_history_') ||
                key.startsWith('practice_session_wrong_')) {
                keysToRemove.push(key);
            }
        });
        
       
        
        // 清理存储项
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
   
    } catch (error) {
        console.error('清理本地数据失败:', error);
    }
}

// 保留旧函数名以兼容现有调用
function clearLocalStorageExceptUser() {
    clearLocalLearningData();
}

// 删除重复的showMembershipExpiredNotification函数，统一使用showMembershipExpiredLoginNotification

// 显示会员时间不足一小时的提醒（与小程序的showExpiryWarning保持一致）
function showMembershipExpiryWarning(timeRemaining) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.setAttribute('data-closeable', 'false');
        
        // 计算剩余时间显示（与小程序保持一致）
        const minutes = Math.floor(timeRemaining / (1000 * 60));
        let timeDisplay;
        if (minutes < 60) {
            timeDisplay = minutes + '分钟';
        } else {
            timeDisplay = Math.floor(minutes / 60) + '小时' + (minutes % 60) + '分钟';
        }
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 520px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
                    <h3><i class="fas fa-clock"></i> 会员即将到期</h3>
                    <span class="close-btn" onclick="handleWarningClose()">&times;</span>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 64px; color: #f59e0b; margin-bottom: 16px;">
                            ⏰
                        </div>
                        <h4 style="color: #1f2937; margin-bottom: 12px;">您的会员即将到期</h4>
                        <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
                            您的会员将在 <strong style="color: #f59e0b;">${timeDisplay}</strong> 后到期。<br/>
                            请及时将本地数据同步到云端，<br/>
                            到期后，您的本地学习数据将被清理并强制退出登录。<br/>
                            建议您及时升级会员以保留学习进度。
                        </p>
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                            <p style="color: #92400e; margin: 0; font-size: 14px;">
                                💡 升级会员后，您的所有学习数据将继续保留但需要手动同步到云端。
                            </p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #6b7280; font-size: 14px; cursor: pointer;">
                                <input type="checkbox" id="dont-remind-checkbox" style="margin: 0;">
                                <span>不再提醒</span>
                            </label>
                        </div>
                        
                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button class="secondary-btn" onclick="handleWarningClose()">
                                <i class="fas fa-times"></i> 稍后再说
                            </button>
                            <button class="membership-btn" onclick="handleWarningUpgrade()">
                                <i class="fas fa-crown"></i> 立即升级
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 全局函数，处理弹窗关闭（与小程序的onExpiryWarningClose保持一致）
        window.handleWarningClose = function() {
            const dontRemind = document.getElementById('dont-remind-checkbox').checked;
            modal.remove();
            delete window.handleWarningClose;
            delete window.handleWarningUpgrade;
            
            if (dontRemind) {
                // 勾选了不再提醒，保存本地设置（带时间戳，有效期24小时）
                localStorage.setItem('membership_expiry_no_remind', JSON.stringify({
                    enabled: true,
                    timestamp: Date.now()
                }));
            
                resolve({ action: 'no_remind' });
            } else {
                resolve({ action: 'close' });
            }
        };
        
        window.handleWarningUpgrade = function() {
            modal.remove();
            delete window.handleWarningClose;
            delete window.handleWarningUpgrade;
            // 显示会员升级窗口（与小程序的onExpiryWarningUpgrade保持一致）
            forceShowMembershipModal();
            resolve({ action: 'upgrade' });
        };
        
        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleWarningClose();
            }
        });
    });
}

// 显示会员过期确认弹窗（与小程序的showExpiredConfirmModal保持一致）
function showMembershipExpiredConfirmModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.setAttribute('data-closeable', 'false');
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 520px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                    <h3><i class="fas fa-exclamation-triangle"></i> 会员已过期</h3>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 64px; color: #ef4444; margin-bottom: 16px;">
                            🚫
                        </div>
                        <h4 style="color: #1f2937; margin-bottom: 12px;">您的会员已过期</h4>
                        <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
                            您的会员时间已到期，无法继续使用高级功能。<br/>
                            系统将清理本地学习数据并强制退出登录。<br/>
                            请重新购买会员后重新登录。
                        </p>
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                            <p style="color: #92400e; margin: 0; font-size: 14px;">
                                💡 您的学习数据将被保留到云端，重新购买会员后可继续使用
                            </p>
                        </div>
                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button class="secondary-btn" onclick="handleExpiredLater()">
                                <i class="fas fa-clock"></i> 稍后处理
                            </button>
                            <button class="membership-btn" onclick="handleExpiredUpgrade()">
                                <i class="fas fa-crown"></i> 升级会员
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 全局函数，处理弹窗操作（与小程序的onExpiredLater和onExpiredUpgrade保持一致）
        window.handleExpiredLater = function() {
            modal.remove();
            delete window.handleExpiredLater;
            delete window.handleExpiredUpgrade;
            // 调用稍后处理逻辑
            onExpiredLater().then(() => {
                resolve({ action: 'later' });
            });
        };
        
        window.handleExpiredUpgrade = function() {
            modal.remove();
            delete window.handleExpiredLater;
            delete window.handleExpiredUpgrade;
            // 调用升级会员逻辑
            onExpiredUpgrade().then(() => {
                resolve({ action: 'upgrade' });
            });
        };
    });
}

// 稍后处理 - 更新服务器和本地会员状态（不删除examUser，与小程序的onExpiredLater保持一致）
async function onExpiredLater() {
    try {
        if (!currentUser || !currentUser.objectId) {
            console.error('用户信息不完整，无法更新会员状态');
            return;
        }

        // 显示加载状态
        showMessage('处理中...', 'info');

        // 更新服务器，把会员改成非会员（与小程序的逻辑保持一致）
        try {
            const updateResult = await window.leanCloudClient.handleMembershipExpiry(currentUser.objectId);
            if (!updateResult.success) {
                throw new Error(updateResult.message || '云端会员状态更新失败');
            }
       
        } catch (error) {
            console.error('更新服务器会员状态失败:', error);
            showMessage('服务器状态更新失败，请稍后重试', 'error');
            return;
        }

        // 更新本地用户信息（不删除，与小程序的逻辑保持一致）
        currentUser.membershipType = '非会员';
        currentUser.membershipStartTime = null;
        currentUser.membershipEndTime = null;
        
        // 更新本地存储
        localStorage.setItem('examUser', JSON.stringify(currentUser));
        
        // 刷新页面状态
        updateUserInterface();
        showMessage('会员状态已更新', 'success');
        
    } catch (error) {
        console.error('处理会员稍后逻辑失败:', error);
        showMessage('处理失败，请重新登录', 'error');
    }
}

// 过期弹窗升级会员 - 先更新服务器为非会员，然后跳转到用户页面（与小程序的onExpiredUpgrade保持一致）
async function onExpiredUpgrade() {
    try {
        if (!currentUser || !currentUser.objectId) {
            console.error('用户信息不完整，无法更新会员状态');
            return;
        }

        // 显示加载状态
        showMessage('处理中...', 'info');

        // 只更新服务器，把会员改成非会员（与小程序的逻辑保持一致）
        try {
            const updateResult = await window.leanCloudClient.handleMembershipExpiry(currentUser.objectId);
            if (!updateResult.success) {
                throw new Error(updateResult.message || '云端会员状态更新失败');
            }
 
        } catch (error) {
            console.error('更新服务器会员状态失败:', error);
            showMessage('服务器状态更新失败，请稍后重试', 'error');
            return;
        }

        // 更新本地用户信息（但不删除，与小程序的逻辑保持一致）
        currentUser.membershipType = '非会员';
        currentUser.membershipStartTime = null;
        currentUser.membershipEndTime = null;
        
        // 更新本地存储
        localStorage.setItem('examUser', JSON.stringify(currentUser));
        
        // 跳转到用户页面（模拟小程序的用户页面跳转）
        // 在网页版中，我们显示会员升级窗口
        showMessage('正在跳转到会员升级页面...', 'info');
        setTimeout(() => {
            forceShowMembershipModal();
        }, 1000);
        
    } catch (error) {
        console.error('处理会员升级逻辑失败:', error);
        showMessage('处理失败，请重新登录', 'error');
    }
}

// 显示会员过期登录提示（要求重新登录）
function showMembershipExpiredLoginNotification() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-closeable', 'false');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                <h3><i class="fas fa-exclamation-triangle"></i> 会员已过期</h3>
                <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 64px; color: #ef4444; margin-bottom: 16px;">
                        🚫
                    </div>
                    <h4 style="color: #1f2937; margin-bottom: 12px;">您的会员已过期</h4>
                    <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
                        您的会员时间已到期，无法继续使用高级功能。<br/>
                        您的账户已自动降级为非会员状态。<br/>
                        请重新购买会员后重新登录。
                    </p>
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                        <p style="color: #92400e; margin: 0; font-size: 14px;">
                            💡 您的学习数据已保留，重新购买会员后可继续使用
                        </p>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="secondary-btn" onclick="this.closest('.modal').remove(); showAuthModal();">
                            <i class="fas fa-sign-in-alt"></i> 重新登录
                        </button>
                        <button class="membership-btn" onclick="this.closest('.modal').remove(); forceShowMembershipModal();">
                            <i class="fas fa-crown"></i> 购买会员
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 时间工具函数：将UTC时间转换为东八区时间并格式化
function formatChineseDateTime(utcTimeString) {
    if (!utcTimeString) return null;
    
    try {
        const utcTime = new Date(utcTimeString);
        
        // 使用toLocaleString方法转换为中国时区（东八区）
        const options = {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        
        const chinaTimeString = utcTime.toLocaleString('zh-CN', options);
        // 格式化为 YYYY-MM-DD HH:mm:ss，处理各种可能的格式
        let formatted = chinaTimeString
            .replace(/\//g, '-')           // 替换斜杠为连字符
            .replace(/,\s*/g, ' ')         // 替换逗号和空格
            .replace(/上午|下午/g, '')      // 移除上午下午标识
            .replace(/\s+/g, ' ')          // 规范化空格
            .trim();
        
        // 如果格式不符合预期，尝试重新格式化
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(formatted)) {
            // 重新使用标准格式
            const year = utcTime.getFullYear();
            const month = String(utcTime.getMonth() + 1).padStart(2, '0');
            const day = String(utcTime.getDate()).padStart(2, '0');
            const hours = String(utcTime.getHours()).padStart(2, '0');
            const minutes = String(utcTime.getMinutes()).padStart(2, '0');
            const seconds = String(utcTime.getSeconds()).padStart(2, '0');
            
            // 手动计算东八区时间
            const beijingTime = new Date(utcTime.getTime() + (8 * 60 * 60 * 1000) - (utcTime.getTimezoneOffset() * 60 * 1000));
            
            return `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')} ${String(beijingTime.getHours()).padStart(2, '0')}:${String(beijingTime.getMinutes()).padStart(2, '0')}:${String(beijingTime.getSeconds()).padStart(2, '0')}`;
        }
        
        return formatted;
    } catch (error) {
        console.error('时间格式化错误:', error);
        
        // 备用方案：手动计算UTC+8
        try {
            const utcTime = new Date(utcTimeString);
            const chinaTime = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
            
            const year = chinaTime.getUTCFullYear();
            const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(chinaTime.getUTCDate()).padStart(2, '0');
            const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
            const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
            const seconds = String(chinaTime.getUTCSeconds()).padStart(2, '0');
            
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch (fallbackError) {
            console.error('备用时间格式化也失败:', fallbackError);
            return null;
        }
    }
}

// 获取会员剩余时间
function getMembershipRemainingTime() {
    if (!currentUser || currentUser.membershipType === '非会员') {
        return null;
    }
    
    if (currentUser.membershipType === 'sssvip') {
        return '永久有效';
    }
    
    // vip和svip会员都需要检查时间
    if (!currentUser.membershipEndTime) {
        return null;
    }
    
    const now = new Date();
    const endTime = new Date(currentUser.membershipEndTime);
    const diffTime = endTime.getTime() - now.getTime();
    
    if (diffTime <= 0) {
        return '已过期';
    }
    
    // 计算总的天数、小时数、分钟数
    const totalMinutes = Math.floor(diffTime / (1000 * 60));
    const totalHours = Math.floor(diffTime / (1000 * 60 * 60));
    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 计算剩余的小时和分钟
    const days = totalDays;
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    
    // 如果超过30天，显示月/年
    if (totalDays > 365) {
        const years = Math.floor(totalDays / 365);
        const remainingDays = totalDays % 365;
        if (remainingDays > 0) {
            return `${years}年${remainingDays}天`;
        } else {
            return `${years}年`;
        }
    } else if (totalDays > 30) {
        const months = Math.floor(totalDays / 30);
        const remainingDays = totalDays % 30;
        if (remainingDays > 0) {
            return `${months}个月${remainingDays}天`;
        } else {
            return `${months}个月`;
        }
    }
    
    // 详细的天时分显示
    if (days >= 1) {
        // 超过一天：显示天、小时、分钟
        let result = `${days}天`;
        if (hours > 0) {
            result += `${hours}小时`;
        }
        if (minutes > 0) {
            result += `${minutes}分钟`;
        }
        return result;
    } else if (totalHours >= 1) {
        // 不足一天但超过一小时：只显示小时、分钟
        let result = `${hours}小时`;
        if (minutes > 0) {
            result += `${minutes}分钟`;
        }
        return result;
    } else if (totalMinutes >= 1) {
        // 不足一小时：只显示分钟
        return `${minutes}分钟`;
    } else {
        // 不足一分钟
        return '不足1分钟';
    }
}

// 获取会员详细时间信息（包含开始和结束时间）
function getMembershipTimeDetails() {
    if (!currentUser || currentUser.membershipType === '非会员') {
        return null;
    }
    
    if (currentUser.membershipType === 'sssvip') {
        return {
            type: 'permanent',
            startTime: null,
            endTime: null,
            startTimeFormatted: null,
            endTimeFormatted: null,
            remaining: '永久有效'
        };
    }
    
    const startTime = currentUser.membershipStartTime;
    const endTime = currentUser.membershipEndTime;
    
    if (!endTime) {
        return null;
    }
    
    const startTimeFormatted = formatChineseDateTime(startTime);
    const endTimeFormatted = formatChineseDateTime(endTime);
    const remaining = getMembershipRemainingTime();
    
    return {
        type: 'limited',
        startTime: startTime,
        endTime: endTime,
        startTimeFormatted: startTimeFormatted,
        endTimeFormatted: endTimeFormatted,
        remaining: remaining
    };
}

// 删除重复的showMembershipExpiredModal函数，使用统一的过期处理逻辑

// 检查非会员练习限制（每种题型最多30题）
function checkPracticeLimit(questionType, currentIndex) {
    if (!currentUser || currentUser.membershipType === '非会员') {
        if (currentIndex >= 30) {
            showMembershipRequiredModal('继续练习更多题目');
            return false;
        }
    }
    return true;
}

// 显示需要登录的提示模态框
function showLoginRequiredModal(actionName) {
    // 创建临时模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-closeable', 'false');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3><i class="fas fa-lock"></i> 需要登录</h3>
                <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;">
                        🔐
                    </div>
                    <h4 style="color: #1f2937; margin-bottom: 12px;">请先登录</h4>
                    <p style="color: #6b7280; margin-bottom: 24px;">
                        ${actionName}需要登录后才能使用，请先登录您的账户。
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="secondary-btn" onclick="this.closest('.modal').remove()">取消</button>
                        <button class="primary-btn" onclick="this.closest('.modal').remove(); showAuthModal();">
                            <i class="fas fa-sign-in-alt"></i> 立即登录
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 显示需要会员的提示模态框
function showMembershipRequiredModal(actionName) {
    // 创建临时模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-closeable', 'false');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <h3><i class="fas fa-crown"></i> 需要会员</h3>
                <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;">
                        💎
                    </div>
                    <h4 style="color: #1f2937; margin-bottom: 12px;">升级会员享受更多权益</h4>
                    <p style="color: #6b7280; margin-bottom: 24px;">
                        ${actionName}需要升级会员后才能使用。<br/>
                        会员用户可享受无限题目练习、模拟考试、数据云同步等特权服务。
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="secondary-btn" onclick="this.closest('.modal').remove()">稍后再说</button>
                        <button class="membership-btn" onclick="this.closest('.modal').remove(); showMembershipModal();">
                            <i class="fas fa-crown"></i> 立即升级
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 题目类型按钮点击处理
async function handleTypeButtonClick(e) {
    const button = e.currentTarget;
    const type = button.dataset.type;
    
    if (!requireLogin('开始做题练习')) {
        return;
    }
    
    // 检查会员状态并触发会话检测
    if (currentUser && (currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip' || currentUser.membershipType === 'sssvip')) {
        const sessionCheckResult = await triggerSessionCheck(`选择${type}题型`);
        if (!sessionCheckResult.success) {
            return; // 会话过期时不继续执行
        }
    }
    
    if (type) {
        startPractice(type);
    }
}

// 开始练习
function startPractice(type) {
    if (!questionsData[type] || questionsData[type].length === 0) {
        showMessage('该题型暂无题目，请联系管理员添加题目', 'warning');
        return;
    }

    currentQuestionType = type;
    currentQuestions = [...questionsData[type]];
    isExamMode = false;
    
    // 加载进度
    loadProgress(type);
    
    // 隐藏科目按钮（进入练习模式）
    hideSubjectButton();
    
    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    toggleMobileFavoriteButton(true);
    
    // 移动端隐藏底部导航栏
    if (window.innerWidth <= 768) {
        const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
        if (mobileBottomNav) mobileBottomNav.style.display = 'none';
    }
    
    showQuestion();
    updateStatusDisplay();
}

// 开始模拟考试
function startMockExam() {
    // 简化的模拟考试，随机选择题目
    const allQuestions = [];
    Object.keys(questionsData).forEach(type => {
        if (questionsData[type] && questionsData[type].length > 0) {
            const typeQuestions = questionsData[type].slice(0, 5); // 每种题型最多5题
            typeQuestions.forEach(q => {
                allQuestions.push({ ...q, _type: type });
            });
        }
    });

    if (allQuestions.length === 0) {
        showMessage('题库为空，请先导入题目', 'warning');
        return;
    }

    // 随机排序
    currentQuestions = shuffleArray(allQuestions);
    currentQuestionType = 'mock_exam';
    currentQuestionIndex = 0;
    userAnswers = new Array(currentQuestions.length).fill(null);
    judgedAnswers = new Array(currentQuestions.length).fill(false);
    isExamMode = true;

    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    toggleMobileFavoriteButton(true);
    
    // 移动端隐藏底部导航栏
    if (window.innerWidth <= 768) {
        const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
        if (mobileBottomNav) mobileBottomNav.style.display = 'none';
    }
    
    showQuestion();
    updateStatusDisplay();
    showMessage('模拟考试已开始', 'info');
}

// 显示题目
function showQuestion() {
    const shouldRestoreAnalysis = isAnalysisVisible && !isExamMode;

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // 检查非会员练习限制（仅在练习模式下，且非批量练习模式）
    if (!isExamMode && !window.isBatchPractice) {
        if (!checkPracticeLimit(currentQuestionType, currentQuestionIndex)) {
            return;
        }
    }
    
    if (currentQuestionIndex >= currentQuestions.length) {
        if (isExamMode) {
            showExamResult();
        } else {
            showMessage('恭喜！您已完成所有题目', 'success');
            returnToHome();
        }
        return;
    }

    const question = currentQuestions[currentQuestionIndex];
    // 批量练习模式或考试模式下使用题目自带的类型，否则使用当前题型
    const questionType = (isExamMode || window.isBatchPractice) ? (question._type || currentQuestionType) : currentQuestionType;
    
    // 更新题目信息
    const questionNumberEl = document.getElementById('question-number');
    questionNumberEl.textContent = `第${currentQuestionIndex + 1}题`;
    
    // 根据题目来源设置题号颜色（仅在考试模式下）
    questionNumberEl.classList.remove('source-wrong', 'source-favorite', 'source-normal');
    if (isExamMode && question.source) {
        questionNumberEl.classList.add(`source-${question.source}`);
    }
    
    document.getElementById('question-type-label').textContent = getTypeLabel(questionType);
    document.getElementById('question-text').textContent = question.title;
    
    // 为题目区域添加题型标识，用于CSS样式区分
    const questionSection = document.getElementById('question-section');
    questionSection.setAttribute('data-type', questionType);

    // 清空之前的答案反馈和样式
    document.getElementById('answer-feedback').classList.add('hidden');
    
    // 清除所有选项的评判样式
    const allOptions = document.querySelectorAll('.option');
    allOptions.forEach(option => {
        option.classList.remove('correct', 'wrong');
        option.style.pointerEvents = 'auto';
    });
    
    // 清除填空题输入框的评判样式
    const answerInput = document.getElementById('answer-input');
    if (answerInput) {
        answerInput.classList.remove('correct-answer', 'wrong-answer');
        answerInput.disabled = false;
    }

    // 根据题型显示选项或输入框
    if (questionType === 'single_choice' || questionType === 'multiple_choice') {
        showOptions(question, questionType);
        document.getElementById('answer-input-container').classList.add('hidden');
    } else if (questionType === 'true_false') {
        showTrueFalseOptions(question);
        document.getElementById('answer-input-container').classList.add('hidden');
    } else if (questionType === 'fill_blank') {
        showFillBlankInput();
        document.getElementById('options-container').innerHTML = '';
    }

    // 恢复用户答案
    if (userAnswers[currentQuestionIndex] !== null) {
        restoreUserAnswer();
    }

    // 如果已经评判过，显示结果（练习模式或查看详情模式下）
    if (judgedAnswers[currentQuestionIndex] && (!isExamMode || isReviewMode)) {
        const userAnswer = userAnswers[currentQuestionIndex];
        const correctAnswer = question.correctAnswer.trim().toUpperCase();
        
        // 检查是否未作答
        if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
            // 显示未作答状态
            showAnswerFeedback(null, question.correctAnswer, question.explanation, true);
            // 对于未作答的题目，不更新选项样式（保持默认状态）
        } else {
            const userAnswerUpper = userAnswer.toString().trim().toUpperCase();
            const isCorrect = userAnswerUpper === correctAnswer;
            
            // 显示答案反馈
            showAnswerFeedback(isCorrect, question.correctAnswer, question.explanation);
            
            // 更新选项样式
            updateOptionStyles(isCorrect, question.correctAnswer);
        }
    }

    // 更新按钮状态
    updateFavoriteButton();
    
    // 显示答案解析按钮（桌面端）
    const analysisDesktopBtn = document.getElementById('analysis-btn');
    
    // 检查是否已经评题（与showQuestion中的逻辑保持一致）
    const isJudged = judgedAnswers[currentQuestionIndex] && (!isExamMode || isReviewMode);
    
    // 背题模式下保持显示关闭按钮；其他情况下仅在未评题且非考试模式时显示
    if (isExamMode) {
        // 已评题或考试模式，不显示背题按钮
        if (analysisDesktopBtn) analysisDesktopBtn.style.display = 'none';
    } else if (shouldRestoreAnalysis) {
        if (analysisDesktopBtn) analysisDesktopBtn.style.display = 'inline-flex';
    } else if (isJudged) {
        if (analysisDesktopBtn) analysisDesktopBtn.style.display = 'none';
    } else {
        // 未评题且非考试模式，显示背题按钮
        if (analysisDesktopBtn) analysisDesktopBtn.style.display = 'inline-flex';
    }
    
    // 更新移动端按钮状态
    toggleMobileFavoriteButton(true);
    
    // 背题模式下切题后继续保持解析打开
    if (shouldRestoreAnalysis) {
        showAnalysis(question);
    } else if (isAnalysisVisible) {
        hideAnalysis();
    }
    
    // 更新进度显示
    updateStatusDisplay();
}

// 显示选择题选项
function showOptions(question, questionType) {
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    if (!question.options || question.options.length === 0) {
        container.innerHTML = '<p>该题目缺少选项数据</p>';
        return;
    }

    question.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.dataset.index = index;
        optionElement.dataset.value = String.fromCharCode(65 + index); // A, B, C, D

        optionElement.innerHTML = `
            <div class="option-marker">${String.fromCharCode(65 + index)}</div>
            <div class="option-text">${option}</div>
        `;

        optionElement.addEventListener('click', () => {
            // 查看详情模式下不能修改答案
            if (isReviewMode) return;
            // 只有在练习模式下已评判的题目才不能修改
            if (judgedAnswers[currentQuestionIndex] && !isExamMode) return;
            // 防止多次点击触发多次跳转
            if (questionType === 'single_choice' && judgedAnswers[currentQuestionIndex] && isExamMode) return;

            if (questionType === 'single_choice') {
                // 单选题：清除其他选项选中状态
                container.querySelectorAll('.option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                optionElement.classList.add('selected');
                userAnswers[currentQuestionIndex] = optionElement.dataset.value;
                
                // 单选题选择后的处理
                if (isExamMode) {
                    // 考试模式下自动跳到下一题但不评分
                    // 禁用选项点击防止多次触发
                    container.querySelectorAll('.option').forEach(opt => {
                        opt.style.pointerEvents = 'none';
                    });
                    setTimeout(() => {
                        autoNextQuestion();
                    }, 1000);
                } else {
                    // 练习模式下自动评题
                    // 禁用选项点击防止多次触发
                    container.querySelectorAll('.option').forEach(opt => {
                        opt.style.pointerEvents = 'none';
                    });
                    setTimeout(() => {
                        autoSubmitAnswer();
                    }, 300);
                }
            } else if (questionType === 'multiple_choice') {
                // 多选题：切换选中状态
                optionElement.classList.toggle('selected');
                const selectedOptions = container.querySelectorAll('.option.selected');
                const selectedValues = Array.from(selectedOptions).map(opt => opt.dataset.value).sort().join('');
                userAnswers[currentQuestionIndex] = selectedValues || null;
            }
        });

        container.appendChild(optionElement);
    });
}

// 显示判断题选项
function showTrueFalseOptions(question) {
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    const options = question.options || ['对', '错'];
    
    options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.dataset.index = index;
        optionElement.dataset.value = option;

        optionElement.innerHTML = `
            <div class="option-marker">${option}</div>
            <div class="option-text">${option}</div>
        `;

        optionElement.addEventListener('click', () => {
            // 查看详情模式下不能修改答案
            if (isReviewMode) return;
            // 只有在练习模式下已评判的题目才不能修改
            if (judgedAnswers[currentQuestionIndex] && !isExamMode) return;
            // 防止多次点击触发多次跳转
            if (judgedAnswers[currentQuestionIndex] && isExamMode) return;

            container.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            optionElement.classList.add('selected');
            userAnswers[currentQuestionIndex] = option;
            
            // 判断题选择后的处理
            if (isExamMode) {
                // 考试模式下自动跳到下一题但不评分
                // 禁用选项点击防止多次触发
                container.querySelectorAll('.option').forEach(opt => {
                    opt.style.pointerEvents = 'none';
                });
                setTimeout(() => {
                    autoNextQuestion();
                }, 1000);
            } else {
                // 练习模式下自动评题
                // 禁用选项点击防止多次触发
                container.querySelectorAll('.option').forEach(opt => {
                    opt.style.pointerEvents = 'none';
                });
                setTimeout(() => {
                    autoSubmitAnswer();
                }, 300);
            }
        });

        container.appendChild(optionElement);
    });
}

// 显示填空题输入框
function showFillBlankInput() {
    document.getElementById('answer-input-container').classList.remove('hidden');
    const input = document.getElementById('answer-input');
    input.value = userAnswers[currentQuestionIndex] || '';
    
    input.addEventListener('input', () => {
        userAnswers[currentQuestionIndex] = input.value.trim() || null;
    });
}

// 恢复用户答案
function restoreUserAnswer() {
    const userAnswer = userAnswers[currentQuestionIndex];
    const questionType = isExamMode ? currentQuestions[currentQuestionIndex]._type : currentQuestionType;

    if (questionType === 'single_choice' || questionType === 'true_false') {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            if (option.dataset.value === userAnswer) {
                option.classList.add('selected');
            }
        });
    } else if (questionType === 'multiple_choice') {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            if (userAnswer && userAnswer.includes(option.dataset.value)) {
                option.classList.add('selected');
            }
        });
    } else if (questionType === 'fill_blank') {
        document.getElementById('answer-input').value = userAnswer || '';
    }
}

// 提交答案
function submitAnswer() {
    // 检查是否在背题模式
    if (isAnalysisVisible) {
        showMessage('请先退出背题模式', 'warning');
        return;
    }
    
    const userAnswer = userAnswers[currentQuestionIndex];
    
    if (userAnswer === null || userAnswer === '') {
        showMessage('请先作答再提交', 'warning');
        return;
    }

    if (isExamMode) {
        // 考试模式下只保存答案，不评判
        showMessage('答案已提交', 'success');
		 // 直接跳转到下一题
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        // 已经是最后一题，提示可以交卷
        if (isExamMode) {
        showMessage('已完成所有题目，可以点击交卷按钮提交考试', 'info');
        } else {
            showMessage('恭喜！您已完成所有题目', 'success');
            setTimeout(() => {
                returnToHome();
            }, 2000);
        }
    }
        // 保存进度但不评判
        saveProgress();
    } else {
        // 练习模式下正常评判
        processAnswer();
    }
}

// 自动提交答案（用于单选题和判断题）
function autoSubmitAnswer() {
    const userAnswer = userAnswers[currentQuestionIndex];
    
    if (userAnswer === null || userAnswer === '') {
        return;
    }

    processAnswer();
}

// 自动跳转到下一题（考试模式下使用，不评判）
function autoNextQuestion() {
    // 保存当前答案
    saveProgress();
    
    // 检查非会员练习限制（仅练习模式）
    if (!isExamMode && (!currentUser || currentUser.membershipType === '非会员')) {
        // 非会员用户最多只能到第30题（索引29）
        if (currentQuestionIndex >= 29) {
            showMembershipRequiredModal('继续练习更多题目');
            return;
        }
    }
    
    // 直接跳转到下一题
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        // 已经是最后一题，提示可以交卷
        if (isExamMode) {
        showMessage('已完成所有题目，可以点击交卷按钮提交考试', 'info');
        } else {
            showMessage('恭喜！您已完成所有题目', 'success');
            setTimeout(() => {
                returnToHome();
            }, 2000);
        }
    }
}

// 处理答案评判
function processAnswer() {
    const userAnswer = userAnswers[currentQuestionIndex];
    const question = currentQuestions[currentQuestionIndex];
    // 批量练习模式或考试模式下使用题目自带的类型，否则使用当前题型
    const questionType = (isExamMode || window.isBatchPractice) ? (question._type || currentQuestionType) : currentQuestionType;
    const correctAnswer = question.correctAnswer.trim().toUpperCase();
    const userAnswerUpper = userAnswer.toString().trim().toUpperCase();
    
    const isCorrect = userAnswerUpper === correctAnswer;
    
    // 标记为已评判
    judgedAnswers[currentQuestionIndex] = true;
    
    // 更新用户统计
    updateAnswerStatistics(isCorrect);
    
    // 显示答案反馈
    showAnswerFeedback(isCorrect, correctAnswer, question.explanation);
    
    // 更新选项样式
    updateOptionStyles(isCorrect, correctAnswer);
    
    // 隐藏背题按钮（已评题）
    const analysisDesktopBtn = document.getElementById('analysis-btn');
    if (analysisDesktopBtn) analysisDesktopBtn.style.display = 'none';
    
    // 更新移动端按钮状态
    toggleMobileFavoriteButton(true);
    
    // 处理错题本 - 根据小程序逻辑
    if (isExamMode) {
        // 模拟考试模式：答错添加到持久化错题本
        if (!isCorrect) {
            addToWrongQuestions(questionType, question, userAnswer);
        } else {
            removeFromWrongQuestions(questionType, question);
        }
    } else if (isPracticingWrongQuestions || (window.isBatchPractice && !window.isPracticingFavorites)) {
        // 练习错题本模式：答对了从错题本移除
        if (isCorrect) {
            removeFromWrongQuestions(questionType, question);
            // 单题练习时重置标志，批量练习时不重置
            if (!window.isBatchPractice) {
                isPracticingWrongQuestions = false;
            }

        }
    } else {
        // 普通练习模式：答错添加到临时错题练习本（不永久保存）
        if (!isCorrect) {
            addToPracticeWrong(question);
        } else if (isSessionWrongPractice) {
            // 练习本次错题模式：答对时从临时错题练习本移除
            practiceWrongQuestions = practiceWrongQuestions.filter(q => q.title !== question.title);
            practiceWrongCount = practiceWrongQuestions.length;
            savePracticeWrongQuestions(practiceWrongQuestions, question._type || question.type || currentQuestionType);
            
            // 如果是最后一题，延迟后返回普通练习
            if (currentQuestionIndex === currentQuestions.length - 1) {
                setTimeout(() => {
                    finishSessionWrongPractice();
                }, 1500);
            }
        }
    }
    
    // 保存进度
    saveProgress();
    
    // 检查是否是非会员用户的第30题
    const isNonMemberLastQuestion = (!currentUser || currentUser.membershipType === '非会员') && 
                                   currentQuestionIndex === 29 && !isExamMode;
    
    if (isNonMemberLastQuestion) {
        // 非会员用户第30题，不自动跳转，显示完成提示
        setTimeout(() => {
            showMessage('恭喜完成前30题！升级会员可练习更多题目', 'success');
            setTimeout(() => {
                showMembershipRequiredModal('继续练习更多题目');
            }, 2000);
        }, 1500);
    } else if (isCorrect) {
        // 正常情况下，答对了延迟自动跳转到下一题
        setTimeout(() => {
            goToNextQuestion();
        }, 1000);
    } else {
        // 如果答错了，滚动到解析区域
        setTimeout(() => {
            scrollToAnalysis();
        }, 500);
    }
}

// 显示答案反馈
function showAnswerFeedback(isCorrect, correctAnswer, explanation, isUnanswered = false) {
    const feedbackElement = document.getElementById('answer-feedback');
    const resultElement = document.getElementById('feedback-result');
    const correctAnswerElement = document.getElementById('correct-answer');
    const explanationElement = document.getElementById('explanation');
    
    // 设置结果
    if (isUnanswered) {
        resultElement.textContent = '未作答';
        resultElement.className = 'feedback-unanswered';
        correctAnswerElement.innerHTML = `<strong>正确答案：</strong>${correctAnswer}`;
    } else if (isCorrect !== undefined) {
        resultElement.textContent = isCorrect ? '回答正确！' : '回答错误！';
        resultElement.className = isCorrect ? 'feedback-correct' : 'feedback-wrong';
        correctAnswerElement.innerHTML = `<strong>正确答案：</strong>${correctAnswer}`;
    }
    
    // 设置解析
    if (explanation) {
        explanationElement.innerHTML = `<strong>解析：</strong>${explanation}`;
        explanationElement.style.display = 'block';
    } else {
        explanationElement.style.display = 'none';
    }
    
    feedbackElement.classList.remove('hidden');
}

// 更新选项样式
function updateOptionStyles(isCorrect, correctAnswer) {
    const questionType = isExamMode ? currentQuestions[currentQuestionIndex]._type : currentQuestionType;
    
    if (questionType === 'fill_blank') {
        // 处理填空题输入框样式
        const answerInput = document.getElementById('answer-input');
        if (answerInput) {
            // 在练习模式已评判或查看详情模式下禁用输入框
            if ((!isExamMode && judgedAnswers[currentQuestionIndex]) || isReviewMode) {
                answerInput.disabled = true;
            }
            answerInput.classList.add(isCorrect ? 'correct-answer' : 'wrong-answer');
        }
    } else {
        // 处理选择题选项样式
        const options = document.querySelectorAll('.option');
        
        options.forEach(option => {
            const optionValue = option.dataset.value;
            
            if (questionType === 'single_choice' || questionType === 'true_false') {
                if (optionValue === correctAnswer) {
                    option.classList.add('correct');
                } else if (option.classList.contains('selected') && !isCorrect) {
                    option.classList.add('wrong');
                }
            } else if (questionType === 'multiple_choice') {
                if (correctAnswer.includes(optionValue)) {
                    option.classList.add('correct');
                } else if (option.classList.contains('selected')) {
                    option.classList.add('wrong');
                }
            }
            
            // 禁用点击（练习模式已评判或查看详情模式下）
            if ((!isExamMode && judgedAnswers[currentQuestionIndex]) || isReviewMode) {
                option.style.pointerEvents = 'none';
            }
        });
    }
}

// 上一题
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
}

// 下一题
function nextQuestion() {
    if (isAnalysisVisible) {
        goToNextQuestion();
        return;
    }
    
    // 考试模式下不自动评判，直接跳转
    if (isExamMode) {
        goToNextQuestion();
        return;
    }
    
    // 练习模式下如果当前题目未评判且有答案，先自动评判
    if (!judgedAnswers[currentQuestionIndex] && userAnswers[currentQuestionIndex] !== null && userAnswers[currentQuestionIndex] !== '') {
        processAnswer();
        return; // 评判后会自动处理跳转
    }
    
    goToNextQuestion();
}

// 直接跳转到下一题（不进行评判）
function goToNextQuestion() {
    // 检查非会员练习限制
    if (!isExamMode && (!currentUser || currentUser.membershipType === '非会员')) {
        // 非会员用户最多只能到第30题（索引29）
        if (currentQuestionIndex >= 29) {
            showMembershipRequiredModal('继续练习更多题目');
            return;
        }
    }
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        // 已经是最后一题
        if (isReviewMode) {
            // 在查看考试详情模式下，提示已经是最后一题
            showMessage('已经是最后一题了', 'info');
        } else if (isExamMode) {
            // 在考试模式下，显示交卷确认模态框而不是直接提交
            showSubmitConfirmModal();
        } else if (isPracticingWrongQuestions) {
            // 如果是在练习错题本中的题目，返回到错题本界面
            showMessage('已完成错题练习', 'success');
            setTimeout(() => {
                returnToHome();
                // 重新显示错题本
                showWrongQuestionsModal();
            }, 1000);
        } else {
            showMessage('恭喜！您已完成所有题目', 'success');
            setTimeout(() => {
                returnToHome();
            }, 2000);
        }
    }
}

// 加载存储的数据
function loadStoredData() {
    try {
        // 加载题库
        const questionsJson = localStorage.getItem('exam_questions');
        if (questionsJson) {
            questionsData = JSON.parse(questionsJson);
        }

        // 加载收藏
        const subjects = ['毛概', '思修', '近代史', '马原'];
        favorites = {};
        
        subjects.forEach(subject => {
            const favoritesKey = `exam_favorites_${subject}`;
            const favoritesJson = localStorage.getItem(favoritesKey);
            if (favoritesJson) {
                favorites[subject] = JSON.parse(favoritesJson);
            } else {
                // 确保默认结构存在
                favorites[subject] = {
                    'single_choice': [],
                    'multiple_choice': [],
                    'true_false': [],
                    'fill_blank': []
                };
            }
        });

        // 加载错题本
        wrongQuestions = {};
        
        subjects.forEach(subject => {
            const wrongQuestionsKey = `exam_wrong_questions_${subject}`;
            const wrongQuestionsJson = localStorage.getItem(wrongQuestionsKey);
            if (wrongQuestionsJson) {
                wrongQuestions[subject] = JSON.parse(wrongQuestionsJson);
            } else {
                // 确保默认结构存在
                wrongQuestions[subject] = {
                    'single_choice': [],
                    'multiple_choice': [],
                    'true_false': [],
                    'fill_blank': []
                };
            }
        });
        
        // 加载用户统计
        const userStatsJson = localStorage.getItem('exam_user_stats');
        const userStats = userStatsJson ? JSON.parse(userStatsJson) : {};
    } catch (error) {
        console.error('加载存储数据失败:', error);
    }
}

// 添加到错题本
function addToWrongQuestions(type, question, userAnswer) {
    // 确保当前科目存在
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 确保科目对象存在
    if (!wrongQuestions[subjectKey]) {
        wrongQuestions[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!wrongQuestions[subjectKey][type]) {
        wrongQuestions[subjectKey][type] = [];
    }
    
    // 检查是否已存在
    const existingIndex = wrongQuestions[subjectKey][type].findIndex(q => q.title === question.title);
    if (existingIndex >= 0) {
        wrongQuestions[subjectKey][type][existingIndex].userAnswer = userAnswer;
    } else {
        wrongQuestions[subjectKey][type].push({
            ...question,
            userAnswer: userAnswer
        });
    }
    
    // 保存到本地存储（按科目存储）
    const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
    localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
}

// 从错题本移除
function removeFromWrongQuestions(type, question) {
    // 确保当前科目存在
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    if (wrongQuestions[subjectKey] && wrongQuestions[subjectKey][type]) {
        wrongQuestions[subjectKey][type] = wrongQuestions[subjectKey][type].filter(q => q.title !== question.title);
        // 保存到本地存储（按科目存储）
        const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
        localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
    }
}

// 切换收藏状态
function toggleFavorite() {
    const question = currentQuestions[currentQuestionIndex];
    // 批量练习模式或考试模式下使用题目自带的类型，否则使用当前题型
    const questionType = (isExamMode || window.isBatchPractice) ? (question._type || currentQuestionType) : currentQuestionType;
    
    // 确保当前科目存在
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 确保科目对象存在
    if (!favorites[subjectKey]) {
        favorites[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!favorites[subjectKey][questionType]) {
        favorites[subjectKey][questionType] = [];
    }
    
    const existingIndex = favorites[subjectKey][questionType].findIndex(q => q.title === question.title);
    
    if (existingIndex >= 0) {
        // 取消收藏
        favorites[subjectKey][questionType].splice(existingIndex, 1);
        if (favorites[subjectKey][questionType].length === 0) {
            // 不删除空数组，保持结构完整
        }
        showMessage('已取消收藏', 'info');
    } else {
        // 添加收藏
        favorites[subjectKey][questionType].push(question);
        showMessage('已添加到收藏', 'success');
    }
    
    // 保存到本地存储（按科目存储）
    const favoritesKey = `exam_favorites_${subjectKey}`;
    // 获取该科目下所有题型的题目数量
    let subjectFavorites = favorites[subjectKey];
    localStorage.setItem(favoritesKey, JSON.stringify(subjectFavorites));
    updateFavoriteButton();
}

// 更新收藏按钮状态
function updateFavoriteButton() {
    const button = document.getElementById('favorite-btn');
    const question = currentQuestions[currentQuestionIndex];
    // 批量练习模式或考试模式下使用题目自带的类型，否则使用当前题型
    const questionType = (isExamMode || window.isBatchPractice) ? (question._type || currentQuestionType) : currentQuestionType;
    
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    const isFavorited = favorites[subjectKey] && 
        favorites[subjectKey][questionType] && 
        favorites[subjectKey][questionType].some(q => q.title === question.title);
    
    const icon = button.querySelector('i');
    if (isFavorited) {
        icon.className = 'fas fa-star';
        button.classList.add('favorited');
    } else {
        icon.className = 'far fa-star';
        button.classList.remove('favorited');
    }
    
    // 同步移动端悬浮按钮状态
    const mobileBtn = document.getElementById('mobile-favorite-float-btn');
    if (mobileBtn && window.innerWidth <= 768) {
        const mobileIcon = mobileBtn.querySelector('i');
        if (mobileIcon) {
            mobileIcon.className = isFavorited ? 'fas fa-star' : 'far fa-star';
        }
    }
}



// 显示考试结果
function showExamResult() {
    // 直接调用提交考试逻辑
    submitExam();
}

// 返回主页
function returnToHome() {
    // 如果是本次错题练习模式，先询问是否返回原练习
    if (window.isSessionWrongPractice && savedPracticeState) {
        restoreOriginalPractice();
        return;
    }

    if (isAnalysisVisible) {
        hideAnalysis();
    }
    
    document.getElementById('question-section').classList.add('hidden');
    document.getElementById('welcome-section').classList.remove('hidden');
    document.getElementById('question-type-section').classList.remove('hidden');
    
    // 强制隐藏移动端悬浮按钮
    const mobileFloatBtn = document.getElementById('mobile-favorite-float-btn');
    const mobileHomeBtn = document.getElementById('mobile-home-float-btn');
    const analysisDesktopBtn = document.getElementById('analysis-btn');
    const analysisFloatBtn = document.getElementById('analysis-float-btn');
    if (mobileFloatBtn) mobileFloatBtn.style.display = 'none';
    if (mobileHomeBtn) mobileHomeBtn.style.display = 'none';
    if (analysisDesktopBtn) analysisDesktopBtn.style.display = 'none';
    if (analysisFloatBtn) analysisFloatBtn.style.display = 'none';
    
    // 移动端通过toggleMobileFavoriteButton处理
    
    // 移动端恢复显示底部导航栏
    if (window.innerWidth <= 768) {
        const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
        if (mobileBottomNav) mobileBottomNav.style.display = 'flex';
    }
    
//    提交按钮可用
    document.getElementById('submit-btn').disabled = false;
    
    // 显示科目按钮（返回首页）
    showSubjectButton();
    
    // 停止考试计时器
    stopExamTimer();
    
    // 隐藏考试导航栏
    const examNav = document.getElementById('exam-nav');
    examNav.classList.add('hidden');
    
    // 如果是考试模式或查看详情模式，恢复导航按钮
    if (isExamMode || isReviewMode || isPracticingWrongQuestions) {
        document.getElementById('home-btn').style.display = '';
        document.getElementById('wrong-questions-btn').style.display = '';
        document.getElementById('favorites-btn').style.display = '';
    }
    
    // 重置状态
    currentQuestions = [];
    currentQuestionIndex = 0;
    userAnswers = [];
    judgedAnswers = [];
    isExamMode = false;
    isReviewMode = false;
    isPracticingWrongQuestions = false; // 重置练习错题本标志
    window.isPracticingFavorites = false; // 重置练习收藏本标志
    window.isBatchPractice = false; // 重置批量练习标志
    window.isSessionWrongPractice = false; // 重置本次错题练习标志
    savedPracticeState = null; // 清除保存的练习状态
    examStartTime = null;
    examDuration = 0;
    
    // 重置导航栏按钮
    resetExamNavigation();
    
    // 更新主页显示
    updateStatusDisplay();
    
    // 重新计算题库统计信息，确保数据正确显示
    if (questionsData && Object.keys(questionsData).length > 0) {
        calculateStatisticsFromData();
    } else {
        // 如果题库数据不存在，重新加载
        updateStatisticsDisplay();
    }
}

// 恢复原始练习状态
function restoreOriginalPractice() {
    if (!savedPracticeState) {
        returnToHome();
        return;
    }
    
    // 恢复原始练习状态
    currentQuestions = savedPracticeState.questions;
    currentQuestionIndex = savedPracticeState.questionIndex;
    currentQuestionType = savedPracticeState.questionType;
    userAnswers = savedPracticeState.answers;
    judgedAnswers = savedPracticeState.judged;
    window.isBatchPractice = savedPracticeState.isBatchPractice;
    isPracticingWrongQuestions = savedPracticeState.isPracticingWrongQuestions;
    window.isPracticingFavorites = savedPracticeState.isPracticingFavorites;
    
    // 清除本次错题练习状态
    window.isSessionWrongPractice = false;
    savedPracticeState = null;
    
    // 显示题目
    showQuestion();
    updateStatusDisplay();
    
    // 恢复后保存一次进度，确保状态同步
    saveProgress();
    
    showMessage('已返回原练习', 'success');
}

// 重置考试导航栏
function resetExamNavigation() {
    const navSubmitBtn = document.getElementById('nav-submit-exam-btn');
    
    // 移除所有事件监听器并重置按钮
    navSubmitBtn.replaceWith(navSubmitBtn.cloneNode(true));
    const newNavSubmitBtn = document.getElementById('nav-submit-exam-btn');
    
    // 恢复默认状态
    newNavSubmitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 交卷';
    newNavSubmitBtn.classList.remove('hidden');
    
    // 重新绑定初始事件监听器（但不会触发，因为考试导航栏是隐藏的）
    newNavSubmitBtn.addEventListener('click', showSubmitConfirmModal);
    
    // 显示计时器
    const timer = document.querySelector('.exam-timer');
    if (timer) {
        timer.style.display = 'flex';
    }
}

// 更新状态显示
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-text');
    const statusContainer = document.getElementById('connection-status');
    
    statusElement.textContent = message;
    
    // 清除之前的状态类
    statusContainer.classList.remove('connected', 'success', 'error');
    
    // 添加新的状态类
    if (type === 'connected' || type === 'success') {
        statusContainer.classList.add('connected');
    }
}

// 更新状态栏显示
function updateStatusDisplay() {
    const progressElement = document.getElementById('current-progress');
    
    if (currentQuestions.length > 0) {
        // 在练习或考试模式下显示进度
        const total = currentQuestions.length;
        const current = currentQuestionIndex + 1;
        progressElement.textContent = `第 ${current} 题 / 共 ${total} 题(点击可切换题目)`;
    } else {
        // 在主页显示欢迎信息
        progressElement.textContent = '祝您学习愉快！';
    }
    
    // 添加点击事件监听器（只添加一次）
    if (!progressElement.hasAttribute('data-listener-added')) {
        progressElement.addEventListener('click', showQuestionNumberModal);
        progressElement.setAttribute('data-listener-added', 'true');
    }
}

// 显示题号选择模态框
function showQuestionNumberModal() {
    // 只在练习或考试模式下显示
    if (currentQuestions.length === 0) {
        return;
    }
    
    const modal = document.getElementById('question-number-modal');
    const container = document.getElementById('question-numbers-container');
    
    // 清空容器
    container.innerHTML = '';
    
    // 更新本次练习错题按钮的显示状态和数量
    updateSessionWrongButton();
    
    // 生成题号按钮
    for (let i = 0; i < currentQuestions.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'question-number-btn';
        btn.textContent = i + 1;
        btn.setAttribute('data-index', i);
        
        const question = currentQuestions[i];
        
        // 题目导航不标记来源颜色，只在题号显示区域标记
        
        // 设置题号状态样式
        if (i === currentQuestionIndex) {
            btn.classList.add('current'); // 当前题目
        } else if (isReviewMode || (isExamMode && judgedAnswers[i])) {
            // 查看详情模式或考试已判分状态：显示对错状态
            const userAnswer = userAnswers[i];
            
            if (userAnswer === null || userAnswer === '') {
                // 未作答：白色（默认样式）
            } else {
                const correctAnswer = question.correctAnswer.trim().toUpperCase();
                const userAnswerUpper = userAnswer.toString().trim().toUpperCase();
                
                if (userAnswerUpper === correctAnswer) {
                    btn.classList.add('correct'); // 答对：绿色
                } else {
                    btn.classList.add('wrong'); // 答错：红色
                }
            }
        } else if (isExamMode) {
            // 考试模式下（未交卷）：只区分已作答和未作答
            if (userAnswers[i] !== null && userAnswers[i] !== '') {
                btn.classList.add('answered'); // 已作答
            }
            // 未作答的题目保持默认样式
        } else if (judgedAnswers[i]) {
            // 练习模式下：显示对错状态
            const userAnswer = userAnswers[i];
            const correctAnswer = question.correctAnswer.trim().toUpperCase();
            const userAnswerUpper = userAnswer ? userAnswer.toString().trim().toUpperCase() : '';
            
            if (userAnswerUpper === correctAnswer) {
                btn.classList.add('correct'); // 答对
            } else {
                btn.classList.add('wrong'); // 答错
            }
        }
        // 未作答的题目保持默认样式
        
        // 添加点击事件
        btn.addEventListener('click', () => {
            jumpToQuestion(i);
        });
        
        container.appendChild(btn);
    }
    
    // 显示模态框
    modal.classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 更新题目导航中本次练习错题按钮的显示状态
function updateSessionWrongButton() {
    const section = document.getElementById('nav-session-wrong-section');
    const countElement = document.getElementById('nav-session-wrong-count');
    
    if (!section || !countElement) return;
    
    // 考试模式或查看详情模式下隐藏
    if (isExamMode || isReviewMode) {
        section.style.display = 'none';
        return;
    }
    
    // 如果当前正在进行本次错题练习，隐藏按钮
    if (window.isSessionWrongPractice) {
        section.style.display = 'none';
        return;
    }
    
    // 统计本次练习中做错的题目数量
    let wrongCount = 0;
    for (let i = 0; i < currentQuestions.length; i++) {
        if (judgedAnswers[i]) {
            const userAnswer = userAnswers[i];
            const correctAnswer = currentQuestions[i].correctAnswer.trim().toUpperCase();
            const userAnswerUpper = userAnswer ? userAnswer.toString().trim().toUpperCase() : '';
            
            if (userAnswerUpper !== correctAnswer) {
                wrongCount++;
            }
        }
    }
    
    // 更新显示
    countElement.textContent = `${wrongCount}题`;
    section.style.display = 'block';
    
    // 如果没有错题，禁用按钮
    const btn = document.getElementById('nav-session-wrong-btn');
    if (btn) {
        if (wrongCount === 0) {
            btn.disabled = true;
            btn.classList.add('disabled');
        } else {
            btn.disabled = false;
            btn.classList.remove('disabled');
        }
    }
}

// 获取本次练习中做错的题目
function getSessionWrongQuestions() {
    let wrongList = [];
    
    for (let i = 0; i < currentQuestions.length; i++) {
        if (judgedAnswers[i]) {
            const userAnswer = userAnswers[i];
            const correctAnswer = currentQuestions[i].correctAnswer.trim().toUpperCase();
            const userAnswerUpper = userAnswer ? userAnswer.toString().trim().toUpperCase() : '';
            
            if (userAnswerUpper !== correctAnswer) {
                wrongList.push({
                    ...currentQuestions[i],
                    _originalIndex: i, // 记录原始索引
                    _type: currentQuestions[i]._type || currentQuestionType
                });
            }
        }
    }
    
    return wrongList;
}



// 从题目导航开始本次错题练习
function startSessionWrongPractice() {
    // 先关闭题目导航模态框
    hideQuestionNumberModal();
    
    // 获取本次练习的错题
    const wrongQuestionsList = getSessionWrongQuestions();
    
    if (!wrongQuestionsList || wrongQuestionsList.length === 0) {
        showMessage('本次练习暂无错题', 'warning');
        return;
    }
    
    // 先保存当前练习进度到本地存储
    saveProgress();
    
    // 保存当前练习状态到内存
    savedPracticeState = {
        questions: [...currentQuestions],
        questionIndex: currentQuestionIndex,
        questionType: currentQuestionType,
        answers: [...userAnswers],
        judged: [...judgedAnswers],
        isBatchPractice: window.isBatchPractice,
        isPracticingWrongQuestions: isPracticingWrongQuestions,
        isPracticingFavorites: window.isPracticingFavorites
    };
    
    // 设置本次错题练习的状态
    currentQuestions = wrongQuestionsList;
    currentQuestionIndex = 0;
    userAnswers = new Array(wrongQuestionsList.length).fill(null);
    judgedAnswers = new Array(wrongQuestionsList.length).fill(false);
    isExamMode = false;
    isReviewMode = false;
    window.isSessionWrongPractice = true; // 标记为本次错题练习模式
    window.isBatchPractice = true;
    
    showQuestion();
    updateStatusDisplay();
    
    showMessage(`开始本次错题练习，共${wrongQuestionsList.length}道题`, 'success');
}

// 跳转到指定题目
function jumpToQuestion(index) {
    if (index >= 0 && index < currentQuestions.length) {
        // 保存当前题目的答案（如果是练习模式且已作答但未评判）
        if (!isExamMode && userAnswers[currentQuestionIndex] !== null && userAnswers[currentQuestionIndex] !== '' && !judgedAnswers[currentQuestionIndex]) {
            // 先评判当前题目
            processAnswer();
        }
        
        // 切换到指定题目
        currentQuestionIndex = index;
        showQuestion();
        
        // 隐藏模态框
        document.getElementById('question-number-modal').classList.add('hidden');
        // 隐藏模态框时移除页面滚动限制
        document.body.classList.remove('modal-open');
    }
}

// 隐藏题号选择模态框
function hideQuestionNumberModal() {
    document.getElementById('question-number-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 显示Loading
function showLoading(message = '正在处理...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    
    if (text) text.textContent = message;
    if (overlay) overlay.style.display = 'flex';
}

// 隐藏Loading
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// 显示收藏模态框
function showFavoritesModal() {
    if (!requireLogin('查看收藏题目')) {
        return;
    }
    
    // 获取当前科目的收藏题目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    let favoriteCount = 0;
    
    if (favorites[subjectKey]) {
        Object.values(favorites[subjectKey]).forEach(items => {
            favoriteCount += items.length;
        });
    }
    
    if (favoriteCount === 0) {
        showMessage('暂无收藏题目', 'info');
    } else {
        let message = `共收藏了 ${favoriteCount} 个题目`;
        if (!currentUser || currentUser.membershipType === '非会员') {
            message += '（非会员数据不会云端存档）';
        }
        showMessage(message, 'info');
    }
}

// 显示错题本模态框
function showWrongQuestionsModal() {
    if (!requireLogin('查看错题本')) {
        return;
    }
    
    // 获取当前科目的错题
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    let wrongCount = 0;
    
    if (wrongQuestions[subjectKey]) {
        Object.values(wrongQuestions[subjectKey]).forEach(items => {
            wrongCount += items.length;
        });
    }
    
    if (wrongCount === 0) {
        showMessage('暂无错题', 'info');
    } else {
        let message = `错题本中有 ${wrongCount} 个题目`;
        if (!currentUser || currentUser.membershipType === '非会员') {
            message += '（非会员数据不会云端存档）';
        }
        showMessage(message, 'info');
    }
}

// 从错题本移除
// 保存进度
function saveProgress() {
    // 本次错题练习模式下不保存进度，避免覆盖原练习记录
    if (window.isSessionWrongPractice) {
        return;
    }
    
    if (!isExamMode && currentQuestionType) {
        // 非会员用户只能保存前30题的进度
        const maxSaveIndex = (!currentUser || currentUser.membershipType === '非会员') ? 29 : currentQuestions.length - 1;
        
        // 限制保存的题目范围
        const limitedQuestions = currentQuestions.slice(0, maxSaveIndex + 1);
        const limitedUserAnswers = userAnswers.slice(0, maxSaveIndex + 1);
        const limitedJudgedAnswers = judgedAnswers.slice(0, maxSaveIndex + 1);
        
        // 保存完整的题目状态信息（仅限制范围内）
        const detailedProgress = limitedQuestions.map((question, index) => ({
            question: {
                id: question.id,
                title: question.title,
                type: question.type || currentQuestionType,
                options: question.options || [],
                correctAnswer: question.correctAnswer,
                explanation: question.explanation || ''
            },
            userAnswer: limitedUserAnswers[index],
            isJudged: limitedJudgedAnswers[index],
            isCorrect: limitedJudgedAnswers[index] ? 
                (limitedUserAnswers[index] && limitedUserAnswers[index].toString().trim().toUpperCase() === question.correctAnswer.trim().toUpperCase()) : 
                null
        }));
        
        // 限制当前索引不超过允许范围
        const limitedCurrentIndex = Math.min(currentQuestionIndex, maxSaveIndex);
        
        const progress = {
            currentIndex: limitedCurrentIndex,
            userAnswers: limitedUserAnswers,
            judgedAnswers: limitedJudgedAnswers,
            detailedProgress: detailedProgress,
            timestamp: Date.now(),
            maxAllowedIndex: maxSaveIndex // 记录最大允许索引
        };
        
        // 根据当前科目保存进度数据
        const subjectKey = (currentSubject && currentSubject.name) || 'default';
        localStorage.setItem(`exam_progress_${subjectKey}_${currentQuestionType}`, JSON.stringify(progress));
        
    }
}

// 加载进度
function loadProgress(type) {
    try {
        // 根据当前科目加载进度数据
        const subjectKey = (currentSubject && currentSubject.name) || 'default';
        const progressData = localStorage.getItem(`exam_progress_${subjectKey}_${type}`);
        if (progressData) {
            const progress = JSON.parse(progressData);
            currentQuestionIndex = progress.currentIndex || 0;
            
            // 检查是否是非会员用户的限制数据
            const isLimitedData = progress.maxAllowedIndex !== undefined;
            const maxAllowedIndex = progress.maxAllowedIndex || (currentQuestions.length - 1);
            
            // 初始化完整长度的数组
                userAnswers = new Array(currentQuestions.length).fill(null);
                judgedAnswers = new Array(currentQuestions.length).fill(false);
            
            // 恢复保存的答案数据
            if (progress.userAnswers && progress.judgedAnswers) {
                const savedAnswers = progress.userAnswers;
                const savedJudged = progress.judgedAnswers;
                
                // 只恢复允许范围内的数据
                const restoreCount = Math.min(savedAnswers.length, maxAllowedIndex + 1, currentQuestions.length);
                
                for (let i = 0; i < restoreCount; i++) {
                    if (i < savedAnswers.length) {
                        userAnswers[i] = savedAnswers[i];
                    }
                    if (i < savedJudged.length) {
                        judgedAnswers[i] = savedJudged[i];
                    }
                }
                
               
            }
            
            // 对于非会员用户，确保当前索引不超过限制
            if ((!currentUser || currentUser.membershipType === '非会员') && currentQuestionIndex > 29) {
                currentQuestionIndex = 29;
            }
            
        } else {
            currentQuestionIndex = 0;
            userAnswers = new Array(currentQuestions.length).fill(null);
            judgedAnswers = new Array(currentQuestions.length).fill(false);
        }
    } catch (error) {
        console.error('加载进度失败:', error);
        currentQuestionIndex = 0;
        userAnswers = new Array(currentQuestions.length).fill(null);
        judgedAnswers = new Array(currentQuestions.length).fill(false);
    }
}

// 加载存储的数据
// 更新UI
function updateUI() {
    // 更新题型按钮状态
    document.querySelectorAll('[data-type]').forEach(btn => {
        const type = btn.dataset.type;
        if (type && questionsData[type] && questionsData[type].length > 0) {
            btn.disabled = false;
        }
    });

    // 检查是否有题目可以进行模拟考试
    const hasQuestions = Object.values(questionsData).some(questions => questions && questions.length > 0);
    const mockExamBtn = document.getElementById('mock-exam-btn');
    if (mockExamBtn) {
        mockExamBtn.disabled = !hasQuestions;
    }

    updateStatusDisplay();
    updateStatisticsDisplay();
}



// 工具函数
function getTypeLabel(type) {
    const labels = {
        'single_choice': '单选题',
        'multiple_choice': '多选题',
        'true_false': '判断题',
        'fill_blank': '填空题'
    };
    return labels[type] || type;
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function showMessage(message, type = 'info', duration = 3000) {
    const messageArea = document.getElementById('message-area');
    if (!messageArea) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    const icons = {
        'success': '<i class="fas fa-check-circle"></i>',
        'error': '<i class="fas fa-times-circle"></i>', 
        'warning': '<i class="fas fa-exclamation-triangle"></i>',
        'info': '<i class="fas fa-info-circle"></i>'
    };
    
    messageElement.innerHTML = `
        ${icons[type] || icons.info}
        <span>${message}</span>
    `;

    messageArea.appendChild(messageElement);

    setTimeout(() => {
        messageElement.style.animation = 'messageSlideIn 0.3s reverse';
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 300);
    }, duration);
}

// 出题记录管理器
const ExamQuestionHistory = {
    // 获取当前科目的出题记录
    getHistory(subject, questionType) {
        const key = `exam_question_history_${subject}_${questionType}`;
        const history = localStorage.getItem(key);
        return history ? JSON.parse(history) : {
            correctQuestions: [], // 作对的题目ID列表
            totalGenerated: 0     // 总出题数
        };
    },
    
    // 添加作对的题目到历史记录
    addCorrectQuestion(subject, questionType, questionId) {
        const history = this.getHistory(subject, questionType);
        // 添加到列表开头
        history.correctQuestions.unshift(questionId);
        // 只保留最近的记录（避免存储膨胀）
        if (history.correctQuestions.length > 50) {
            history.correctQuestions = history.correctQuestions.slice(0, 50);
        }
        history.totalGenerated++;
        this.saveHistory(subject, questionType, history);
    },
    
    // 保存历史记录
    saveHistory(subject, questionType, history) {
        const key = `exam_question_history_${subject}_${questionType}`;
        localStorage.setItem(key, JSON.stringify(history));
    },
    
    // 检查题目是否在近期作对过
    wasRecentlyCorrect(subject, questionType, questionId) {
        const history = this.getHistory(subject, questionType);
        return history.correctQuestions.includes(questionId);
    },
    
    // 清理指定科目和题型的历史记录
    clearHistory(subject, questionType) {
        const key = `exam_question_history_${subject}_${questionType}`;
        localStorage.removeItem(key);
    }
};

// 清理所有科目的考试记录会话
function clearAllExamQuestionHistory() {
    // 清理所有以exam_question_history_开头的localStorage项
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('exam_question_history_')) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });
}

// 基于优先级的智能抽题算法
function smartSelectQuestions(subject, questionType, requestedCount) {
    // 获取当前科目的数据
    const subjectKey = subject || currentSubject || '毛概';
    
    // 获取题目数据
    const allQuestions = questionsData[questionType] || [];
    if (allQuestions.length === 0) return [];
    
    // 获取错题本和收藏数据
    const wrongQuestionsData = (wrongQuestions[subjectKey] && wrongQuestions[subjectKey][questionType]) || [];
    const favoritesData = (favorites[subjectKey] && favorites[subjectKey][questionType]) || [];
    
    // 获取出题历史
    const history = ExamQuestionHistory.getHistory(subjectKey, questionType);
    
    // 创建题目分类映射
    const wrongQuestionMap = new Map();
    const favoriteQuestionMap = new Map();
    
    // 建立映射关系（通过title识别题目）
    wrongQuestionsData.forEach(q => wrongQuestionMap.set(q.title, q));
    favoritesData.forEach(q => favoriteQuestionMap.set(q.title, q));
    
    // 分类题目并标记来源
    const wrongQuestionsList = wrongQuestionsData.map(q => ({...q, source: 'wrong'}));
    const favoritesList = favoritesData
        .filter(q => !wrongQuestionMap.has(q.title)) // 排除已在错题本中的题目
        .map(q => ({...q, source: 'favorite'}));
    const normalQuestionsList = allQuestions
        .filter(q => !wrongQuestionMap.has(q.title) && !favoriteQuestionMap.has(q.title)) // 排除已在错题本和收藏中的题目
        .map(q => ({...q, source: 'normal'}));
    
    // 过滤掉近期作对的题目
    const filterRecentCorrect = (questions) => {
        return questions.filter(q => !ExamQuestionHistory.wasRecentlyCorrect(subjectKey, questionType, q.title));
    };
    
    const filteredWrong = filterRecentCorrect(wrongQuestionsList);
    const filteredFavorites = filterRecentCorrect(favoritesList);
    const filteredNormal = filterRecentCorrect(normalQuestionsList);
    
    // 计算总体权重
    const totalWrong = filteredWrong.length;
    const totalFavorites = filteredFavorites.length;
    const totalNormal = filteredNormal.length;
    const totalAvailable = totalWrong + totalFavorites + totalNormal;
    
    if (totalAvailable === 0) {
        // 如果没有可用题目，返回原始题目中的随机选择
        return shuffleArray([...allQuestions]).slice(0, requestedCount).map(q => ({...q, _type: questionType}));
    }
    
    // 按优先级分配抽取概率
    // 错题本:收藏:题库 = 50%:30%:20%
    const wrongWeight = 0.5;
    const favoriteWeight = 0.3;
    const normalWeight = 0.2;
    
    const selectedQuestions = [];
    const usedTitles = new Set();
    
    // 抽取题目
    for (let i = 0; i < requestedCount; i++) {
        if (selectedQuestions.length >= totalAvailable) break;
        
        // 生成随机数决定从哪个池子抽取
        const random = Math.random();
        let selectedQuestion = null;
        
        if (random < wrongWeight && filteredWrong.length > 0) {
            // 从错题本抽取
            const availableWrong = filteredWrong.filter(q => !usedTitles.has(q.title));
            if (availableWrong.length > 0) {
                selectedQuestion = availableWrong[Math.floor(Math.random() * availableWrong.length)];
            }
        }
        
        if (!selectedQuestion && random < (wrongWeight + favoriteWeight) && filteredFavorites.length > 0) {
            // 从收藏抽取
            const availableFavorites = filteredFavorites.filter(q => !usedTitles.has(q.title));
            if (availableFavorites.length > 0) {
                selectedQuestion = availableFavorites[Math.floor(Math.random() * availableFavorites.length)];
            }
        }
        
        if (!selectedQuestion && filteredNormal.length > 0) {
            // 从题库抽取
            const availableNormal = filteredNormal.filter(q => !usedTitles.has(q.title));
            if (availableNormal.length > 0) {
                selectedQuestion = availableNormal[Math.floor(Math.random() * availableNormal.length)];
            }
        }
        
        // 如果还没选到题目，从任意可用题目中选一个
        if (!selectedQuestion) {
            const allAvailable = [...filteredWrong, ...filteredFavorites, ...filteredNormal]
                .filter(q => !usedTitles.has(q.title));
            if (allAvailable.length > 0) {
                selectedQuestion = allAvailable[Math.floor(Math.random() * allAvailable.length)];
            }
        }
        
        if (selectedQuestion) {
            selectedQuestions.push({...selectedQuestion, _type: questionType});
            usedTitles.add(selectedQuestion.title);
        }
    }
    
    return selectedQuestions;
}

// 显示考试配置模态框
async function showExamConfigModal() {
    if (!requireLogin('参加模拟考试')) {
        return;
    }
    
    if (!requireMembership('参加模拟考试')) {
        return;
    }
    
    // 🔐 触发会话检查，如果会话失效则不继续打开模态框
    const sessionCheckResult = await triggerSessionCheck('开始模拟考试');
    if (!sessionCheckResult.success && sessionCheckResult.sessionExpired) {
        // 会话已失效，不打开模态框
        return;
    }
    
    // 检查数据是否已加载，如果没有则重新计算统计信息
    if (!statistics.total) {
        if (questionsData && Object.keys(questionsData).length > 0) {
            calculateStatisticsFromData();
        } else {
            // 题库数据还未加载完成，显示提示
            showMessage('题库数据正在加载中，请稍后再试...', 'warning');
            return;
        }
    }
    
    // 使用已计算的统计数据更新可用题目数量，避免重复计算
    document.getElementById('single-available').textContent = statistics.single_choice || 0;
    document.getElementById('multiple-available').textContent = statistics.multiple_choice || 0;
    document.getElementById('judge-available').textContent = statistics.true_false || 0;
    document.getElementById('fill-available').textContent = statistics.fill_blank || 0;
    
    // 使用统计数据计算默认值
    const maxSingle = Math.min(40, statistics.single_choice || 0);
    const maxMultiple = Math.min(30, statistics.multiple_choice || 0);
    const maxJudge = Math.min(30, statistics.true_false || 0);
    const maxFill = Math.min(0, statistics.fill_blank || 0);
    
    document.getElementById('single-count-input').value = maxSingle;
    document.getElementById('multiple-count-input').value = maxMultiple;
    document.getElementById('judge-count-input').value = maxJudge;
    document.getElementById('fill-count-input').value = maxFill;
    
    updateExamSummary();
    
    // 默认显示考试设置面板
    switchExamTab('exam-settings');
    
    // 渲染考试记录
    renderExamHistory();
    
    document.getElementById('exam-config-modal').classList.remove('hidden');
    
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏考试配置模态框
function hideExamConfigModal() {
    document.getElementById('exam-config-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 切换考试面板
function switchExamTab(tabId) {
    // 更新标签状态
    document.querySelectorAll('.exam-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    
    // 更新面板显示
    document.querySelectorAll('.exam-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });
}

// 隐藏考试题目数超限提示模态框
function hideExamLimitModal() {
    document.getElementById('exam-limit-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 更新考试摘要
function updateExamSummary() {
    const singleInput = document.getElementById('single-count-input');
    const multipleInput = document.getElementById('multiple-count-input');
    const judgeInput = document.getElementById('judge-count-input');
    const fillInput = document.getElementById('fill-count-input');
    
    let singleCount = parseInt(singleInput.value) || 0;
    let multipleCount = parseInt(multipleInput.value) || 0;
    let judgeCount = parseInt(judgeInput.value) || 0;
    let fillCount = parseInt(fillInput.value) || 0;
    
    // 检查并调整超过可用题目数的输入值
    const maxSingle = statistics.single_choice || 0;
    const maxMultiple = statistics.multiple_choice || 0;
    const maxJudge = statistics.true_false || 0;
    const maxFill = statistics.fill_blank || 0;
    
    let adjusted = false;
    
    if (singleCount > maxSingle) {
        singleCount = maxSingle;
        singleInput.value = singleCount;
        adjusted = true;
    }
    
    if (multipleCount > maxMultiple) {
        multipleCount = maxMultiple;
        multipleInput.value = multipleCount;
        adjusted = true;
    }
    
    if (judgeCount > maxJudge) {
        judgeCount = maxJudge;
        judgeInput.value = judgeCount;
        adjusted = true;
    }
    
    if (fillCount > maxFill) {
        fillCount = maxFill;
        fillInput.value = fillCount;
        adjusted = true;
    }
    
    // 如果有调整，显示提示信息
    if (adjusted) {
        showMessage('检测到输入的题目数超过可用数量，已自动调整为最大可用数量', 'info');
    }
    
    const totalQuestions = singleCount + multipleCount + judgeCount + fillCount;
    const estimatedTime = totalQuestions; // 每题预计1分钟
    
    document.getElementById('total-exam-questions').textContent = totalQuestions;
    document.getElementById('estimated-time').textContent = estimatedTime + '分钟';
    
    // 检查用户是否为SSSVIP用户，SSSVIP用户不受100题限制
    const isSSSVIPUser = currentUser && 
        (currentUser.membershipType === 'sssvip' || 
         currentUser.membershipType === 'SSSVIP' || 
         currentUser.membershipType?.toUpperCase() === 'SSSVIP');
    
    // 检查总题目数是否超过100道限制（SSSVIP用户不受此限制）
    const totalLimitExceeded = !isSSSVIPUser && totalQuestions > 100;
    if (totalLimitExceeded) {
        document.getElementById('total-exam-questions').style.color = '#ef4444';
        document.getElementById('estimated-time').style.color = '#ef4444';
    } else {
        document.getElementById('total-exam-questions').style.color = '';
        document.getElementById('estimated-time').style.color = '';
    }
    
    // 使用已计算的统计数据检查是否超出可用题目数量，避免重复访问questionsData
    const startBtn = document.getElementById('start-exam');
    let canStart = totalQuestions > 0;
    
    // 如果总题目数超过限制，显示提示信息（SSSVIP用户不显示此限制）
    if (totalLimitExceeded) {
        document.getElementById('total-exam-questions').title = '单次考试总题目数不得超过100道题';
        document.getElementById('estimated-time').title = '单次考试总题目数不得超过100道题';
    } else if (isSSSVIPUser) {
        // SSSVIP用户显示特殊提示
        document.getElementById('total-exam-questions').title = 'SSSVIP用户可享受无限制考试题目数量';
        document.getElementById('estimated-time').title = 'SSSVIP用户可享受无限制考试题目数量';
    } else {
        document.getElementById('total-exam-questions').title = '';
        document.getElementById('estimated-time').title = '';
    }
    
    startBtn.disabled = !canStart;
    
    // 动态更新HTML中的考试限制提示
    updateExamLimitTip(isSSSVIPUser);
}

// 动态更新考试限制提示信息
function updateExamLimitTip(isSSSVIPUser) {
    const examLimitTip = document.getElementById('exam-limit-tip');
    const examLimitText = document.getElementById('exam-limit-text');
    
    if (!examLimitTip || !examLimitText) return;
    
    if (isSSSVIPUser) {
        // SSSVIP用户显示特殊提示
        examLimitText.textContent = 'SSSVIP用户可享受无限制考试题目数量';
        examLimitTip.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        examLimitTip.style.color = 'white';
        examLimitTip.querySelector('i').className = 'fas fa-crown';
    } else {
        // 普通用户显示标准提示
        examLimitText.textContent = '单次考试总题目数不得超过100道题';
        examLimitTip.style.background = '';
        examLimitTip.style.color = '';
        examLimitTip.querySelector('i').className = 'fas fa-info-circle';
    }
}

// 更新考试限制超限模态框内容
function updateExamLimitModal(totalQuestions) {
    const modalIcon = document.getElementById('limit-modal-icon');
    const modalTitle = document.getElementById('limit-modal-title');
    const modalContent = document.getElementById('limit-modal-content');
    const modalSuggestion = document.getElementById('limit-modal-suggestion');
    const currentTotalSpan = document.getElementById('current-total-questions');
    
    if (!modalIcon || !modalTitle || !modalContent || !modalSuggestion) return;
    
    // 检查用户是否为SSSVIP用户
    const isSSSVIPUser = currentUser && 
        (currentUser.membershipType === 'sssvip' || 
         currentUser.membershipType === 'SSSVIP' || 
         currentUser.membershipType?.toUpperCase() === 'SSSVIP');
    
    if (isSSSVIPUser) {
        // SSSVIP用户不应该看到超限模态框，但以防万一
        modalIcon.textContent = '👑';
        modalIcon.style.color = '#a63ad1';
        modalTitle.textContent = 'SSSVIP特权';
        modalTitle.style.color = '#a63ad1';
        modalContent.innerHTML = `恭喜！作为SSSVIP用户，您不受考试题目数量限制。<br/>
                                  当前设置的总题目数为 <span style="font-weight: bold; color: #a63ad1;">${totalQuestions}</span> 道题。<br/>
                                  您可以尽情享受无限制的考试体验。`;
        modalSuggestion.style.background = 'linear-gradient(135deg, #a63ad1 0%, #667eea 100%)';
        modalSuggestion.style.borderLeft = '4px solid #a63ad1';
        modalSuggestion.querySelector('p').style.color = 'white';
        modalSuggestion.querySelector('p').innerHTML = '💎 SSSVIP特权：无限考试题目数量，尽情挑战！';
    } else {
        // 普通用户显示标准超限信息
        modalIcon.textContent = '⚠️';
        modalIcon.style.color = '#ef4444';
        modalTitle.textContent = '题目数超过限制';
        modalTitle.style.color = '#1f2937';
        modalContent.innerHTML = `单次考试总题目数不得超过100道题。<br/>
                                  当前设置的总题目数为 <span style="font-weight: bold; color: #ef4444;">${totalQuestions}</span> 道题。<br/>
                                  请调整题目数量后重新开始考试。`;
        modalSuggestion.style.background = '#fef3c7';
        modalSuggestion.style.borderLeft = '4px solid #f59e0b';
        modalSuggestion.querySelector('p').style.color = '#92400e';
        modalSuggestion.querySelector('p').innerHTML = '💡 建议：您可以适当减少各题型的题目数量，确保总题目数不超过100道题。';
    }
    
    if (currentTotalSpan) {
        currentTotalSpan.textContent = totalQuestions;
    }
}

// 开始配置的模拟考试
function startConfiguredExam() {
    const singleInput = document.getElementById('single-count-input');
    const multipleInput = document.getElementById('multiple-count-input');
    const judgeInput = document.getElementById('judge-count-input');
    const fillInput = document.getElementById('fill-count-input');
    
    let singleCount = parseInt(singleInput.value) || 0;
    let multipleCount = parseInt(multipleInput.value) || 0;
    let judgeCount = parseInt(judgeInput.value) || 0;
    let fillCount = parseInt(fillInput.value) || 0;
    
    // 检查并调整超过可用题目数的输入值
    const maxSingle = statistics.single_choice || 0;
    const maxMultiple = statistics.multiple_choice || 0;
    const maxJudge = statistics.true_false || 0;
    const maxFill = statistics.fill_blank || 0;
    
    if (singleCount > maxSingle) {
        singleCount = maxSingle;
        singleInput.value = singleCount;
    }
    
    if (multipleCount > maxMultiple) {
        multipleCount = maxMultiple;
        multipleInput.value = multipleCount;
    }
    
    if (judgeCount > maxJudge) {
        judgeCount = maxJudge;
        judgeInput.value = judgeCount;
    }
    
    if (fillCount > maxFill) {
        fillCount = maxFill;
        fillInput.value = fillCount;
    }
    
    const totalQuestions = singleCount + multipleCount + judgeCount + fillCount;
    
    // 检查用户是否为SSSVIP用户，SSSVIP用户不受100题限制
    const isSSSVIPUser = currentUser && 
        (currentUser.membershipType === 'sssvip' || 
         currentUser.membershipType === 'SSSVIP' || 
         currentUser.membershipType?.toUpperCase() === 'SSSVIP');
    
    // 检查总题目数是否超过100道限制（SSSVIP用户不受此限制）
    if (!isSSSVIPUser && totalQuestions > 100) {
        // 更新超限提示模态框的内容
        updateExamLimitModal(totalQuestions);
        // 显示超限提示模态框
        document.getElementById('exam-limit-modal').classList.remove('hidden');
        return;
    }
    
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 在开始抽题前，检查是否需要清理历史记录（整体检查）
    checkAndClearHistoryIfNeeded(subjectKey, singleCount, multipleCount, judgeCount, fillCount);
    
    const examQuestions = [];
    
    // 添加单选题（使用智能抽题算法）
    if (singleCount > 0 && questionsData.single_choice) {
        const selected = smartSelectQuestions(subjectKey, 'single_choice', singleCount);
        examQuestions.push(...selected);
    }
    
    // 添加多选题（使用智能抽题算法）
    if (multipleCount > 0 && questionsData.multiple_choice) {
        const selected = smartSelectQuestions(subjectKey, 'multiple_choice', multipleCount);
        examQuestions.push(...selected);
    }
    
    // 添加判断题（使用智能抽题算法）
    if (judgeCount > 0 && questionsData.true_false) {
        const selected = smartSelectQuestions(subjectKey, 'true_false', judgeCount);
        examQuestions.push(...selected);
    }
    
    // 添加填空题（使用智能抽题算法）
    if (fillCount > 0 && questionsData.fill_blank) {
        const selected = smartSelectQuestions(subjectKey, 'fill_blank', fillCount);
        examQuestions.push(...selected);
    }
    
    if (examQuestions.length === 0) {
        showMessage('没有可用的题目', 'warning');
        return;
    }

    // 随机排序所有题目
    currentQuestions = shuffleArray(examQuestions);
    currentQuestionType = 'mock_exam';
    currentQuestionIndex = 0;
    userAnswers = new Array(currentQuestions.length).fill(null);
    judgedAnswers = new Array(currentQuestions.length).fill(false);
    isExamMode = true;

    // 隐藏模态框
    hideExamConfigModal();
    
    // 隐藏科目按钮（进入考试模式）
    hideSubjectButton();
    
    // 显示题目区域，隐藏导航按钮
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    toggleMobileFavoriteButton(true);
    
    // 移动端隐藏底部导航栏
    if (window.innerWidth <= 768) {
        const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
        if (mobileBottomNav) mobileBottomNav.style.display = 'none';
    }
    
    // 在考试模式下隐藏顶部的所有导航按钮
    document.getElementById('home-btn').style.display = 'none';
    document.getElementById('wrong-questions-btn').style.display = 'none';
    document.getElementById('favorites-btn').style.display = 'none';
    
    // 启动考试计时器
    const actualTotalQuestions = currentQuestions.length;
    startExamTimer(actualTotalQuestions); // 每题1分钟
    
    // 显示考试导航栏
    const examNav = document.getElementById('exam-nav');
    examNav.classList.remove('hidden');
    
    // 更新考试导航栏
    updateExamNavigation();
    
    showQuestion();
    updateStatusDisplay();
    showMessage(`模拟考试已开始，共${actualTotalQuestions}题，时长${actualTotalQuestions}分钟`, 'info');
}

// 检查并清理历史记录（整体检查）
function checkAndClearHistoryIfNeeded(subject, singleCount, multipleCount, judgeCount, fillCount) {
    // 计算每种题型的总题目数
    const singleTotal = questionsData.single_choice ? questionsData.single_choice.length : 0;
    const multipleTotal = questionsData.multiple_choice ? questionsData.multiple_choice.length : 0;
    const judgeTotal = questionsData.true_false ? questionsData.true_false.length : 0;
    const fillTotal = questionsData.fill_blank ? questionsData.fill_blank.length : 0;
    
    // 获取每种题型的历史记录
    const singleHistory = ExamQuestionHistory.getHistory(subject, 'single_choice');
    const multipleHistory = ExamQuestionHistory.getHistory(subject, 'multiple_choice');
    const judgeHistory = ExamQuestionHistory.getHistory(subject, 'true_false');
    const fillHistory = ExamQuestionHistory.getHistory(subject, 'fill_blank');
    
    // 计算每种题型的作对题目数（去重）
    const singleCorrect = new Set(singleHistory.correctQuestions).size;
    const multipleCorrect = new Set(multipleHistory.correctQuestions).size;
    const judgeCorrect = new Set(judgeHistory.correctQuestions).size;
    const fillCorrect = new Set(fillHistory.correctQuestions).size;
    
    // 计算每种题型的可用题目数
    const singleAvailable = singleTotal - singleCorrect;
    const multipleAvailable = multipleTotal - multipleCorrect;
    const judgeAvailable = judgeTotal - judgeCorrect;
    const fillAvailable = fillTotal - fillCorrect;
    
    // 检查每种题型是否需要清理（仅当用户请求该题型且请求数超过可用数时）
    if (singleCount > 0 && singleCount > singleAvailable) {
        singleHistory.correctQuestions = [];
        singleHistory.totalGenerated = 0;
        ExamQuestionHistory.saveHistory(subject, 'single_choice', singleHistory);
    }
    
    if (multipleCount > 0 && multipleCount > multipleAvailable) {
        multipleHistory.correctQuestions = [];
        multipleHistory.totalGenerated = 0;
        ExamQuestionHistory.saveHistory(subject, 'multiple_choice', multipleHistory);
    }
    
    if (judgeCount > 0 && judgeCount > judgeAvailable) {
        judgeHistory.correctQuestions = [];
        judgeHistory.totalGenerated = 0;
        ExamQuestionHistory.saveHistory(subject, 'true_false', judgeHistory);
    }
    
    if (fillCount > 0 && fillCount > fillAvailable) {
        fillHistory.correctQuestions = [];
        fillHistory.totalGenerated = 0;
        ExamQuestionHistory.saveHistory(subject, 'fill_blank', fillHistory);
    }
}

// 显示错题本模态框
// 隐藏错题本模态框
function hideWrongQuestionsModal() {
    document.getElementById('wrong-questions-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 渲染错题列表
function renderWrongQuestions(filterType = '') {
    const container = document.getElementById('wrong-questions-list');
    container.innerHTML = '';
    
    let hasQuestions = false;
    
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 确保当前科目的错题本存在
    if (!wrongQuestions[subjectKey]) {
        wrongQuestions[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    // 只渲染当前科目的错题
    Object.keys(wrongQuestions[subjectKey]).forEach(type => {
        if (filterType && type !== filterType) return;
        
        wrongQuestions[subjectKey][type].forEach((question, index) => {
            hasQuestions = true;
            const questionItem = document.createElement('div');
            questionItem.className = 'question-item';
            questionItem.innerHTML = `
                <div class="question-item-header">
                    <span class="question-type-badge">${getTypeLabel(type)}</span>
                    <div class="question-item-actions">
                        <button class="small-btn practice" onclick="practiceWrongQuestion('${type}', ${index})">练习</button>
                        <button class="small-btn remove" onclick="removeWrongQuestion('${type}', ${index})">移除</button>
                    </div>
                </div>
                <div class="question-item-text">${question.title}</div>
                <div class="question-item-answer">正确答案: ${question.correctAnswer}</div>
            `;
            
            container.appendChild(questionItem);
        });
    });
    
    if (!hasQuestions) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">暂无错题</div>';
    }
}

// 过滤错题
function filterWrongQuestions() {
    const filterType = document.getElementById('wrong-type-filter').value;
    renderWrongQuestions(filterType);
}

// 清空错题本
function clearWrongQuestions() {
    // 显示自定义确认对话框
    document.getElementById('clear-wrong-questions-modal').classList.remove('hidden');
}

// 确认清空错题本
function confirmClearWrongQuestions() {
    // 隐藏确认对话框
    hideClearWrongQuestionsModal();
    
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 清空当前科目的错题本
    wrongQuestions[subjectKey] = {
        'single_choice': [],
        'multiple_choice': [],
        'true_false': [],
        'fill_blank': []
    };
    
    // 保存到本地存储（按科目存储）
    const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
    localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
    renderWrongQuestions();
    updateStatisticsDisplay();
    showMessage('错题本已清空', 'success');
}

// 隐藏清空错题本确认对话框
function hideClearWrongQuestionsModal() {
    document.getElementById('clear-wrong-questions-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 练习错题
function practiceWrongQuestion(type, index) {
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    if (!wrongQuestions[subjectKey] || !wrongQuestions[subjectKey][type] || !wrongQuestions[subjectKey][type][index]) return;
    
    const question = wrongQuestions[subjectKey][type][index];
    currentQuestions = [question];
    currentQuestionType = type;
    currentQuestionIndex = 0;
    userAnswers = [null];
    judgedAnswers = [false];
    isExamMode = false;
    
    // 添加一个标志，表示当前是在练习错题本中的题目
    isPracticingWrongQuestions = true;
    
    hideWrongQuestionsModal();
    
    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    toggleMobileFavoriteButton(true);
    
    // 移动端隐藏底部导航栏
    if (window.innerWidth <= 768) {
        const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
        if (mobileBottomNav) mobileBottomNav.style.display = 'none';
    }
    
    showQuestion();
    updateStatusDisplay();
}

// 移除错题
function removeWrongQuestion(type, index) {
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    if (!wrongQuestions[subjectKey] || !wrongQuestions[subjectKey][type] || !wrongQuestions[subjectKey][type][index]) return;
    
    wrongQuestions[subjectKey][type].splice(index, 1);
    if (wrongQuestions[subjectKey][type].length === 0) {
        delete wrongQuestions[subjectKey][type];
    }
    
    // 保存到本地存储（按科目存储）
    const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
    localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
    renderWrongQuestions();
    updateStatisticsDisplay();
    showMessage('已从错题本移除', 'success');
}

// 显示收藏模态框
// 隐藏收藏模态框
function hideFavoritesModal() {
    document.getElementById('favorites-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 渲染收藏列表
function renderFavorites(filterType = '') {
    const container = document.getElementById('favorites-list');
    container.innerHTML = '';
    
    let hasQuestions = false;
    
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 确保当前科目的收藏存在
    if (!favorites[subjectKey]) {
        favorites[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    // 只渲染当前科目的收藏
    Object.keys(favorites[subjectKey]).forEach(type => {
        if (filterType && type !== filterType) return;
        
        // 确保题型数组存在
        if (!Array.isArray(favorites[subjectKey][type])) {
            favorites[subjectKey][type] = [];
        }
        
        favorites[subjectKey][type].forEach((question, index) => {
            hasQuestions = true;
            const questionItem = document.createElement('div');
            questionItem.className = 'question-item';
            questionItem.innerHTML = `
                <div class="question-item-header">
                    <span class="question-type-badge">${getTypeLabel(type)}</span>
                    <div class="question-item-actions">
                        <button class="small-btn practice" onclick="practiceFavoriteQuestion('${type}', ${index})">练习</button>
                        <button class="small-btn remove" onclick="removeFavoriteQuestion('${type}', ${index})">移除</button>
                    </div>
                </div>
                <div class="question-item-text">${question.title}</div>
                <div class="question-item-answer">正确答案: ${question.correctAnswer}</div>
            `;
            
            container.appendChild(questionItem);
        });
    });
    
    if (!hasQuestions) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">暂无收藏题目</div>';
    }
}

// 过滤收藏
function filterFavorites() {
    const filterType = document.getElementById('favorite-type-filter').value;
    renderFavorites(filterType);
}

// 清空收藏
// 清空收藏
function clearFavorites() {
    // 显示自定义确认对话框
    document.getElementById('clear-favorites-modal').classList.remove('hidden');
}

// 确认清空收藏
function confirmClearFavorites() {
    // 隐藏确认对话框
    hideClearFavoritesModal();
    
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 清空当前科目的收藏
    favorites[subjectKey] = {
        'single_choice': [],
        'multiple_choice': [],
        'true_false': [],
        'fill_blank': []
    };
    
    // 保存到本地存储（按科目存储）
    const favoritesKey = `exam_favorites_${subjectKey}`;
    localStorage.setItem(favoritesKey, JSON.stringify(favorites[subjectKey]));
    renderFavorites();
    updateStatisticsDisplay();
    showMessage('收藏已清空', 'success');
}

// 隐藏清空收藏确认对话框
function hideClearFavoritesModal() {
    document.getElementById('clear-favorites-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 练习收藏题目
// 练习收藏题目
function practiceFavoriteQuestion(type, index) {
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 确保当前科目的收藏存在
    if (!favorites[subjectKey]) {
        favorites[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!favorites[subjectKey][type] || !favorites[subjectKey][type][index]) return;
    
    const question = favorites[subjectKey][type][index];
    currentQuestions = [question];
    currentQuestionType = type;
    currentQuestionIndex = 0;
    userAnswers = [null];
    judgedAnswers = [false];
    isExamMode = false;
    
    hideFavoritesModal();
    
    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    toggleMobileFavoriteButton(true);
    
    // 移动端隐藏底部导航栏
    if (window.innerWidth <= 768) {
        const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
        if (mobileBottomNav) mobileBottomNav.style.display = 'none';
    }
    
    showQuestion();
    updateStatusDisplay();
}

// 移除收藏题目
// 移除收藏题目
function removeFavoriteQuestion(type, index) {
    // 获取当前科目
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 确保当前科目的收藏存在
    if (!favorites[subjectKey]) {
        favorites[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!favorites[subjectKey][type] || !favorites[subjectKey][type][index]) return;
    
    favorites[subjectKey][type].splice(index, 1);
    // 不删除空数组，保持结构完整
    
    // 保存到本地存储（按科目存储）
    const favoritesKey = `exam_favorites_${subjectKey}`;
    localStorage.setItem(favoritesKey, JSON.stringify(favorites[subjectKey]));
    renderFavorites();
    updateStatisticsDisplay();
    showMessage('已从收藏移除', 'success');
}

// ==================== 批量练习功能 ====================

// 获取错题本中的所有题目（可按题型筛选）
function getWrongQuestionsForPractice(filterType = '') {
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    if (!wrongQuestions[subjectKey]) {
        return [];
    }
    
    let questions = [];
    const types = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
    
    types.forEach(type => {
        if (filterType && type !== filterType) return;
        
        if (wrongQuestions[subjectKey][type] && Array.isArray(wrongQuestions[subjectKey][type])) {
            wrongQuestions[subjectKey][type].forEach(question => {
                questions.push({
                    ...question,
                    _type: type // 标记题型，用于混合练习时识别
                });
            });
        }
    });
    
    return questions;
}

// 获取收藏本中的所有题目（可按题型筛选）
function getFavoritesForPractice(filterType = '') {
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    if (!favorites[subjectKey]) {
        return [];
    }
    
    let questions = [];
    const types = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
    
    types.forEach(type => {
        if (filterType && type !== filterType) return;
        
        if (favorites[subjectKey][type] && Array.isArray(favorites[subjectKey][type])) {
            favorites[subjectKey][type].forEach(question => {
                questions.push({
                    ...question,
                    _type: type // 标记题型，用于混合练习时识别
                });
            });
        }
    });
    
    return questions;
}

// 开始批量练习（通用函数）
function startBatchPractice(questions, source = 'wrong') {
    if (!questions || questions.length === 0) {
        showMessage('没有可练习的题目', 'warning');
        return;
    }
    
    // 随机打乱题目顺序
    questions = shuffleArray([...questions]);
    
    currentQuestions = questions;
    currentQuestionIndex = 0;
    userAnswers = new Array(questions.length).fill(null);
    judgedAnswers = new Array(questions.length).fill(false);
    isExamMode = false;
    isReviewMode = false;
    
    // 标记练习来源
    isPracticingWrongQuestions = (source === 'wrong');
    window.isPracticingFavorites = (source === 'favorites');
    window.isBatchPractice = true; // 标记为批量练习模式
    
    // 关闭模态框
    if (source === 'wrong') {
        hideWrongQuestionsModal();
    } else {
        hideFavoritesModal();
    }
    
    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    toggleMobileFavoriteButton(true);
    
    // 移动端隐藏底部导航栏
    if (window.innerWidth <= 768) {
        const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
        if (mobileBottomNav) mobileBottomNav.style.display = 'none';
    }
    
    showQuestion();
    updateStatusDisplay();
    
    const sourceText = source === 'wrong' ? '错题本' : '收藏本';
    showMessage(`开始${sourceText}练习，共${questions.length}道题`, 'success');
}

// 练习全部错题
function practiceAllWrongQuestions() {
    const questions = getWrongQuestionsForPractice();
    startBatchPractice(questions, 'wrong');
}

// 按题型练习错题
function practiceWrongQuestionsByType() {
    const filterType = document.getElementById('wrong-type-filter').value;
    
    if (!filterType) {
        showMessage('请先选择要练习的题型', 'warning');
        return;
    }
    
    const questions = getWrongQuestionsForPractice(filterType);
    startBatchPractice(questions, 'wrong');
}

// 练习全部收藏
function practiceAllFavorites() {
    const questions = getFavoritesForPractice();
    startBatchPractice(questions, 'favorites');
}

// 按题型练习收藏
function practiceFavoritesByType() {
    const filterType = document.getElementById('favorite-type-filter').value;
    
    if (!filterType) {
        showMessage('请先选择要练习的题型', 'warning');
        return;
    }
    
    const questions = getFavoritesForPractice(filterType);
    startBatchPractice(questions, 'favorites');
}

// 数组随机打乱（Fisher-Yates算法）
// 更新错题本批量练习按钮的题目数量显示
function updateWrongQuestionsCount() {
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    let totalCount = 0;
    
    if (wrongQuestions[subjectKey]) {
        const types = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
        types.forEach(type => {
            if (wrongQuestions[subjectKey][type] && Array.isArray(wrongQuestions[subjectKey][type])) {
                totalCount += wrongQuestions[subjectKey][type].length;
            }
        });
    }
    
    const countElement = document.getElementById('wrong-all-count');
    if (countElement) {
        countElement.textContent = `${totalCount}题`;
    }
    
    // 如果没有题目，禁用按钮
    const practiceAllBtn = document.getElementById('practice-all-wrong');
    const practiceByTypeBtn = document.getElementById('practice-wrong-by-type');
    
    if (practiceAllBtn) {
        practiceAllBtn.disabled = totalCount === 0;
    }
    if (practiceByTypeBtn) {
        practiceByTypeBtn.disabled = totalCount === 0;
    }
}

// 更新收藏本批量练习按钮的题目数量显示
function updateFavoritesCount() {
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    let totalCount = 0;
    
    if (favorites[subjectKey]) {
        const types = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
        types.forEach(type => {
            if (favorites[subjectKey][type] && Array.isArray(favorites[subjectKey][type])) {
                totalCount += favorites[subjectKey][type].length;
            }
        });
    }
    
    const countElement = document.getElementById('favorites-all-count');
    if (countElement) {
        countElement.textContent = `${totalCount}题`;
    }
    
    // 如果没有题目，禁用按钮
    const practiceAllBtn = document.getElementById('practice-all-favorites');
    const practiceByTypeBtn = document.getElementById('practice-favorites-by-type');
    
    if (practiceAllBtn) {
        practiceAllBtn.disabled = totalCount === 0;
    }
    if (practiceByTypeBtn) {
        practiceByTypeBtn.disabled = totalCount === 0;
    }
}

// 滚动到解析区域
function scrollToAnalysis() {
    const feedbackElement = document.getElementById('answer-feedback');
    if (feedbackElement && !feedbackElement.classList.contains('hidden')) {
        feedbackElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // 添加高亮效果
        feedbackElement.style.animation = 'none';
        feedbackElement.offsetHeight; // 触发重绘
        feedbackElement.style.animation = 'highlightAnalysis 2s ease';
    }
}

// 显示交卷确认模态框
function showSubmitConfirmModal() {
    const modal = document.getElementById('submit-confirm-modal');
    const answeredCount = userAnswers.filter(answer => answer !== null && answer !== '').length;
    const unansweredCount = currentQuestions.length - answeredCount;
    
    document.getElementById('answered-count').textContent = answeredCount;
    document.getElementById('unanswered-count').textContent = unansweredCount;
    
    modal.classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏交卷确认模态框
function hideSubmitConfirmModal() {
    document.getElementById('submit-confirm-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 提交考试
function submitExam() {
    hideSubmitConfirmModal();
    
    // 停止考试计时器
    stopExamTimer();
    
    // 计算考试结果
    let correctCount = 0;
    let totalCount = currentQuestions.length;
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    // 保存每道题的详情
    const questionsDetail = [];
    
    // 评判所有题目并处理错题本记录
    for (let i = 0; i < currentQuestions.length; i++) {
        const question = currentQuestions[i];
        const userAnswer = userAnswers[i];
        const questionType = question._type;
        const correctAnswer = question.correctAnswer.trim().toUpperCase();
        
        let isCorrect = false;
        if (userAnswer !== null && userAnswer !== '') {
            const userAnswerUpper = userAnswer.toString().trim().toUpperCase();
            isCorrect = userAnswerUpper === correctAnswer;
            
            if (isCorrect) {
                correctCount++;
                // 记录作对的题目到出题历史（按题型分别记录）
                ExamQuestionHistory.addCorrectQuestion(subjectKey, questionType, question.title);
                // 如果答对了，从错题本中移除
                removeFromWrongQuestions(questionType, question);
            } else {
                // 只在模拟考试模式下记录错题
                addToWrongQuestions(questionType, question, userAnswer);
            }
        }
        
        // 保存题目详情
        questionsDetail.push({
            title: question.title,
            type: questionType,
            options: question.options || null,
            correctAnswer: question.correctAnswer,
            userAnswer: userAnswer,
            isCorrect: isCorrect,
            explanation: question.explanation || '',
            source: question.source || 'normal'
        });
    }
    
    const wrongCount = totalCount - correctCount;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const score = Math.round((correctCount / totalCount) * 100);
    
    // 计算用时
    const usedTime = examStartTime ? Math.floor((Date.now() - examStartTime) / 1000) : 0;
    
    // 保存考试记录（包含题目详情）
    saveExamRecord(subjectKey, {
        score: score,
        totalCount: totalCount,
        correctCount: correctCount,
        wrongCount: wrongCount,
        accuracy: accuracy,
        usedTime: usedTime,
        date: new Date().toISOString(),
        questions: questionsDetail
    });
    
    // 显示考试结果
    showExamResultModal(score, totalCount, correctCount, wrongCount, accuracy);
}

// 显示考试结果模态框
function showExamResultModal(score, totalCount, correctCount, wrongCount, accuracy) {
    const modal = document.getElementById('exam-result-modal');
    
    document.getElementById('exam-score').textContent = score;
    document.getElementById('exam-total-questions').textContent = totalCount;
    document.getElementById('correct-questions').textContent = correctCount;
    document.getElementById('wrong-questions-count').textContent = wrongCount;
    document.getElementById('accuracy-rate').textContent = accuracy + '%';
    
    modal.classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏考试结果模态框
function hideExamResultModal() {
    document.getElementById('exam-result-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 查看考试详情
function reviewExamDetails() {
    hideExamResultModal();
    
    // 进入查看详情模式
    isReviewMode = true;
    // 提交按钮不可用
    document.getElementById('submit-btn').disabled = true;
    
    // 更新移动端悬浮按钮（交卷变成首页）
    toggleMobileFavoriteButton(true);
   

    
    
    // 标记所有题目为已评判状态以显示正确答案
    for (let i = 0; i < currentQuestions.length; i++) {
        judgedAnswers[i] = true;
    }
    
    // 显示考试导航栏
    const examNav = document.getElementById('exam-nav');
    examNav.classList.remove('hidden');
    
    // 更新导航栏显示
    updateExamNavigation();
    
    // 回到第一题开始查看
    currentQuestionIndex = 0;
    showQuestion();
    
    showMessage('现在可以查看所有题目的正确答案和解析', 'info');
}

// 启动考试计时器
function startExamTimer(durationMinutes) {
    examDuration = durationMinutes;
    examStartTime = Date.now();
    
    // 显示考试导航栏
    document.getElementById('exam-nav').classList.remove('hidden');
    
    // 更新计时器显示
    updateTimerDisplay();
    
    // 每秒更新一次
    examTimer = setInterval(updateTimerDisplay, 1000);
    
    // 在移动端显示考试倒计时悬浮按钮
    if (window.innerWidth <= 768) {
        const mobileTimerBtn = document.getElementById('mobile-exam-timer-float');
        if (mobileTimerBtn) {
            mobileTimerBtn.style.display = 'flex';
        }
    }
}

// 停止考试计时器
function stopExamTimer() {
    if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }
    
    // 隐藏考试导航栏
    document.getElementById('exam-nav').classList.add('hidden');
    
    // 隐藏移动端考试倒计时悬浮按钮
    const mobileTimerBtn = document.getElementById('mobile-exam-timer-float');
    if (mobileTimerBtn) {
        mobileTimerBtn.style.display = 'none';
    }
}

// 更新计时器显示
function updateTimerDisplay() {
    if (!examStartTime || !examDuration) return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - examStartTime) / 1000); // 已过去的秒数
    const totalSeconds = examDuration * 60; // 总秒数
    const remaining = Math.max(0, totalSeconds - elapsed); // 剩余秒数
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = display;
    
    // 同时更新移动端悬浮倒计时
    const mobileTimerDisplay = document.getElementById('mobile-timer-display');
    if (mobileTimerDisplay) {
        mobileTimerDisplay.textContent = display;
    }
    
    // 时间用完自动交卷
    if (remaining === 0) {
        showMessage('考试时间已到，自动交卷', 'warning');
        setTimeout(() => {
            submitExam();
        }, 1000);
    }
    
    // 最后5分钟警告
    if (remaining === 300) {
        showMessage('剩余时间5分钟，请注意时间', 'warning');
    }
    
    // 最后1分钟警告
    if (remaining === 60) {
        showMessage('剩余时间1分钟！', 'warning');
    }
}

// 更新考试导航栏显示
function updateExamNavigation() {
    const examNav = document.getElementById('exam-nav');
    const navSubmitBtn = document.getElementById('nav-submit-exam-btn');
    
    // 移除所有现有的事件监听器
    navSubmitBtn.replaceWith(navSubmitBtn.cloneNode(true));
    const newNavSubmitBtn = document.getElementById('nav-submit-exam-btn');
    
    if (isReviewMode) {
        // 查看详情模式：显示返回首页按钮
        newNavSubmitBtn.innerHTML = '<i class="fas fa-home"></i> 返回首页';
        newNavSubmitBtn.addEventListener('click', returnToHome);
        
        // 隐藏计时器
        document.querySelector('.exam-timer').style.display = 'none';
    } else if (isExamMode) {
        // 考试模式：显示交卷按钮和计时器
        newNavSubmitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 交卷';
        newNavSubmitBtn.addEventListener('click', showSubmitConfirmModal);
        
        // 显示计时器
        document.querySelector('.exam-timer').style.display = 'flex';
    }
}

// ========== 用户系统功能 ==========

// 当前用户信息
let currentUser = null;

// 会员状态检查定时器
let membershipCheckTimer = null;

// 🔐 会话管理相关变量
let sessionCheckTimer = null; // 会话检查定时器
let sessionCheckInProgress = false; // 会话检查进行中标志
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查间隔

// 独立的时间不足检查函数（每10分钟执行一次，与小程序逻辑保持一致）
async function checkMembershipTimeWarning() {
    // 如果用户未登录或不是有时限的会员，无需检查
    if (!currentUser || 
        !(currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip') || 
        !currentUser.membershipEndTime) {
        return;
    }
    
    const now = new Date();
    const endTime = new Date(currentUser.membershipEndTime);
    const timeRemaining = endTime.getTime() - now.getTime();
    const oneHourInMs = 60 * 60 * 1000; // 一小时的毫秒数
    
    // 检查是否已过期，如果已过期就不显示提醒了
    if (timeRemaining <= 0) {
        return;
    }
    
    // 检查是否时间不足一小时且用户未选择"不再提醒"（与小程序的checkMembershipTimeWarning保持一致）
    if (timeRemaining <= oneHourInMs) {
        // 检查"不再提醒"设置（与小程序的逻辑保持一致）
        const noRemindData = localStorage.getItem('membership_expiry_no_remind');
        let shouldShowWarning = true;
        
        if (noRemindData) {
            try {
                const noRemind = JSON.parse(noRemindData);
                // 检查24小时有效期（与小程序的逻辑保持一致）
                if (noRemind.enabled && noRemind.timestamp) {
                    const timeDiff = Date.now() - noRemind.timestamp;
                    const twentyFourHours = 24 * 60 * 60 * 1000; // 24小时毫秒数
                    
                    // 如果在24小时内，不显示提醒
                    if (timeDiff < twentyFourHours) {
                        shouldShowWarning = false;
                    } else {
                        // 超过24小时，清除"不再提醒"设置
                        localStorage.removeItem('membership_expiry_no_remind');
                    }
                }
            } catch (error) {
                console.error('解析"不再提醒"设置失败:', error);
                localStorage.removeItem('membership_expiry_no_remind');
            }
        }
        
        if (shouldShowWarning) {
            try {
                const result = await showMembershipExpiryWarning(timeRemaining);
                
                // 处理结果（与小程序的逻辑保持一致）
                if (result.action === 'upgrade') {
                    // 用户选择升级会员，显示会员窗口
                    forceShowMembershipModal();
                }
                // 'close' 和 'no_remind' 都只是关闭弹窗，不做其他操作
            } catch (error) {
                console.error('会员时间不足提醒处理失败:', error);
            }
        }
    }
}

// 启动会员状态定期检查（每10分钟检查一次）
function startMembershipStatusCheck() {
    // 清除之前的定时器
    if (membershipCheckTimer) {
        clearInterval(membershipCheckTimer);
    }
    
    // 只对有时限的会员启动定期检查
    if (currentUser && (currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip') && currentUser.membershipEndTime) {

        
        // 立即检查一次时间不足提醒
        checkMembershipTimeWarning().catch(error => {
            console.error('会员时间检查失败:', error);
        });
        
        // 每10分钟检查一次时间不足提醒
        membershipCheckTimer = setInterval(async () => {
            try {
                await checkMembershipTimeWarning();
            } catch (error) {
                console.error('定期会员时间检查失败:', error);
            }
            //设备检查时间
        }, 10 * 60 * 1000); // 10分钟
    }
}

// 停止会员状态检查
function stopMembershipStatusCheck() {
    if (membershipCheckTimer) {
        clearInterval(membershipCheckTimer);
        membershipCheckTimer = null;

    }
}

// 🔐 会话管理函数
// 检查会话有效性
async function checkSessionValidity() {
    try {
        // 🔧 防止重复请求 - 如果正在检查中，直接返回
        if (sessionCheckInProgress) {
      
            return { success: true, sessionExpired: false };
        }

        // 只检查VIP和SVIP用户
        if (!currentUser || !currentUser.sessionId || 
            (currentUser.membershipType !== 'vip' && currentUser.membershipType !== 'svip')) {
            return { success: true, sessionExpired: false };
        }

        sessionCheckInProgress = true; // 🔒 设置请求锁
    
        
        const result = await window.leanCloudClient.validateSession(currentUser.id, currentUser.sessionId);
        
        if (!result.success) {
            if (result.code === 'SESSION_EXPIRED') {
                console.warn('⚠️ 会话已失效:', result.message);
                await handleSessionExpired(result.message);
                return { success: false, sessionExpired: true };
            } else {
                console.error('❌ 会话验证失败:', result.message);
                return { success: false, sessionExpired: false };
            }
        } else {
     
            return { success: true, sessionExpired: false };
        }
    } catch (error) {
        console.error('会话检查失败:', error);
        return { success: false, sessionExpired: false };
    } finally {
        sessionCheckInProgress = false; // 🔓 释放请求锁
    }
}

// 🎯 手动触发会话检查（用于特定操作）
async function triggerSessionCheck(actionName = '操作') {
    if (!currentUser || !currentUser.sessionId || 
        (currentUser.membershipType !== 'vip' && currentUser.membershipType !== 'svip' && currentUser.membershipType !== 'sssvip')) {
        return { success: true, sessionExpired: false, message: '非会员用户，无需检查' };
    }


    
    // 直接调用检查函数并返回结果
    const result = await checkSessionValidity();
    
    return result;
}





// 获取本地进度数据（动态科目 - 扫描localStorage）








// 处理会话过期
async function handleSessionExpired(message) {
    // 停止所有定时器
    stopSessionCheck();
    stopMembershipStatusCheck();
    
    // 清除用户信息
    currentUser = null;
    localStorage.removeItem('examUser');
    
    // 🔧 清理所有科目的考试记录会话
    clearAllExamQuestionHistory();
    
    // 🔐 检查当前状态并采取对应措施
    const examConfigModal = document.getElementById('exam-config-modal');
    const isInExamConfigModal = examConfigModal && !examConfigModal.classList.contains('hidden');
    const isCurrentlyInExam = isExamMode && !isReviewMode;
    
    if (isInExamConfigModal) {
        // 如果在模拟考试配置框中，直接关闭配置框
        hideExamConfigModal();
    }
    
    if (isCurrentlyInExam) {
        // 如果在考试中，直接返回首页
        returnToHome();
    }
    
    // 显示友好的提示弹窗
    showSessionExpiredModal(message);
    
    // 如果不在考试中，也返回主页并显示登录界面
    if (!isCurrentlyInExam) {
        returnToHome();
        setTimeout(() => {
            showAuthModal();
        }, 1000);
    } else {
        // 在考试中的情况，延迟显示登录界面
        setTimeout(() => {
            showAuthModal();
        }, 1000);
    }
}

// 显示会话过期提示弹窗
function showSessionExpiredModal(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-closeable', 'false');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                <h3><i class="fas fa-exclamation-triangle"></i> 设备限制提醒</h3>
                <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 64px; color: #ef4444; margin-bottom: 16px;">
                        🔐
                    </div>
                    <h4 style="color: #1f2937; margin-bottom: 12px;">账号已在其他设备登录</h4>
                    <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
                        ${message || '您的VIP/SVIP账号已在其他设备登录，当前会话已失效。'}<br/>
                        为保护您的账号安全，同一时间只允许在一个设备上使用。
                    </p>
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                        <p style="color: #92400e; margin: 0; font-size: 14px;">
                            💡 如果不是您本人操作，请及时修改密码
                        </p>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="primary-btn" onclick="this.closest('.modal').remove(); showAuthModal();">
                            <i class="fas fa-sign-in-alt"></i> 重新登录
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 启动会话检查
function startSessionCheck() {
    // 只为VIP和SVIP用户启动会话检查
    if (!currentUser || !currentUser.sessionId || 
        (currentUser.membershipType !== 'vip' && currentUser.membershipType !== 'svip')) {
        return;
    }

    // 🔧 防止重复启动 - 先停止现有的定时器
    stopSessionCheck();

  
    
    // 立即检查一次
    setTimeoutAsync(checkSessionValidity, 0);
    
    // 设置定时检查
    sessionCheckTimer = setInterval(() => {
        checkSessionValidity().catch(error => {
            console.error('定期会话检查失败:', error);
        });
    }, SESSION_CHECK_INTERVAL);
}

// 停止会话检查
function stopSessionCheck() {
    if (sessionCheckTimer) {
        clearInterval(sessionCheckTimer);
        sessionCheckTimer = null;
      
    }
    // 🔧 重置请求锁标志
    sessionCheckInProgress = false;
}

// 异步setTimeout辅助函数
function setTimeoutAsync(fn, delay) {
    setTimeout(() => {
        if (typeof fn === 'function') {
            fn().catch(error => console.error('异步setTimeout执行失败:', error));
        }
    }, delay);
}

// 初始化用户系统
async function initUserSystem() {
    try {
        // 首先尝试自动登录（从localStorage恢复会话并验证）
        const autoLoginResult = await window.leanCloudClient.autoLogin();
        
        if (autoLoginResult.success) {
         
            
            // 直接设置用户数据（过期检查已在leancloud-client.js的autoLogin中处理）
            currentUser = autoLoginResult.user;
           
            
            // 触发用户登录事件，通知主题管理器
            window.dispatchEvent(new Event('userLoggedIn'));
 
            
            // 自动登录成功后也立即检查会员状态（确保本地存储一致性）
            const membershipCheck = await checkCurrentUserMembershipStatus();
            
            if (membershipCheck.needsAction) {
                // 如果检测到过期等问题，处理已经在checkCurrentUserMembershipStatus中完成
            
                return; // 不继续后续的初始化流程
            }
            
            // 合并云端统计数据到本地全局变量，但不要覆盖本地已有的数据
            if (currentUser.statistics) {
                statistics = { ...currentUser.statistics, ...statistics };
            }
            
            // 合并用户的收藏和错题本数据，确保本地数据优先
            if (currentUser.favorites) {
                // 遍历云端数据，只在本地没有该科目数据时才使用云端数据
                Object.keys(currentUser.favorites).forEach(subject => {
                    if (!favorites[subject]) {
                        favorites[subject] = currentUser.favorites[subject];
                    }
                    // 对于已存在的科目，合并题型数据，本地数据优先
                    else {
                        Object.keys(currentUser.favorites[subject]).forEach(type => {
                            if (!favorites[subject][type]) {
                                favorites[subject][type] = currentUser.favorites[subject][type];
                            }
                        });
                    }
                });
            }
            
            if (currentUser.wrongQuestions) {
                // 遍历云端数据，只在本地没有该科目数据时才使用云端数据
                Object.keys(currentUser.wrongQuestions).forEach(subject => {
                    if (!wrongQuestions[subject]) {
                        wrongQuestions[subject] = currentUser.wrongQuestions[subject];
                    }
                    // 对于已存在的科目，合并题型数据，本地数据优先
                    else {
                        Object.keys(currentUser.wrongQuestions[subject]).forEach(type => {
                            if (!wrongQuestions[subject][type]) {
                                wrongQuestions[subject][type] = currentUser.wrongQuestions[subject][type];
                            }
                        });
                    }
                });
            }
                
                updateUserInterface();
                
                // 启动会员状态定期检查
                startMembershipStatusCheck();
                
                // 🔐 启动会话检查（仅VIP/SVIP用户）
                startSessionCheck();
                
                // 显示欢迎回来的消息
                setTimeout(() => {
                    showMessage(`欢迎回来，${currentUser.username}！`, 'success');
                }, 1000);
                
                // 检查是否需要显示科目选择
                checkSubjectSelection();
                
                // 自动登录成功后也显示通知（如果用户没有设置不再提醒且不是SSSVIP用户）
                if (window.noticeManager && currentUser.membershipType?.toUpperCase() !== 'SSSVIP') {
                    window.noticeManager.showNoticeOnLogin();
                }
                
                // 隐藏活动和通知按钮（SSSVIP用户）
                setTimeout(() => {
                    updateActivityNoticeVisibility();
                }, 100);
        } else {
            // 自动登录失败，检查是否有本地会话（离线模式）
            const userResult = window.leanCloudClient.getCurrentUser();
            if (userResult.success) {
                currentUser = userResult.user;
                
                // 离线模式下也检查会员状态（确保本地存储一致性）
                const membershipCheck = await checkCurrentUserMembershipStatus();
                
                if (membershipCheck.needsAction) {
                    // 如果检测到过期等问题，处理已经在checkCurrentUserMembershipStatus中完成
       
                    return; // 不继续后续的初始化流程
                }
                
                // 同步统计数据
                if (currentUser.statistics) {
                    statistics = { ...statistics, ...currentUser.statistics };
                }
                
                updateUserInterface();
                
                // 启动会员状态定期检查
                startMembershipStatusCheck();
                

                
                // 提示用户网络连接问题（如果适用）
                if (autoLoginResult.message && (autoLoginResult.message.includes('网络') || autoLoginResult.message.includes('连接'))) {
                    setTimeout(() => {
                        showMessage('网络连接异常，请检查！', 'warning');
                    }, 1000);
                }
                
                // 检查是否需要显示科目选择
                checkSubjectSelection();
            }
        }
    } catch (error) {
        console.error('用户系统初始化失败:', error);
        
        // 发生错误时，尝试使用本地数据
        const userResult = window.leanCloudClient.getCurrentUser();
        if (userResult.success) {
            currentUser = userResult.user;
            
            // 错误恢复时也检查会员状态（确保本地存储一致性）
            try {
                const membershipCheck = await checkCurrentUserMembershipStatus();
                
                if (membershipCheck.needsAction) {
                    // 如果检测到过期等问题，处理已经在checkCurrentUserMembershipStatus中完成
   
                    return; // 不继续后续的初始化流程
                }
            } catch (checkError) {
                console.error('错误恢复时的会员状态检查失败:', checkError);
                // 即使检查失败，也继续使用本地数据，但可能存在不一致
            }
            
            updateUserInterface();
            
            // 启动会员状态定期检查
            startMembershipStatusCheck();
            

	        }
    } finally {
        syncThemePermissionState(false);
    }
    
    // 控制个人中心按钮显示
    updateUserCenterVisibility();
}

// 显示认证模态框
function showAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
    showLoginForm();
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏认证模态框
function hideAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
    // 重置表单
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    // 重置为登录表单状态，避免下次打开时显示错误的表单
    showLoginForm();
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 显示用户中心模态框
function showUserCenterModal() {
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    updateUserCenterContent();
    
    // 更新主题按钮状态（每次打开个人中心时重新检查权限）
    if (window.themeManager) {
        window.themeManager.updateThemeToggleButton();
    }
    
    document.getElementById('user-center-modal').classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏用户中心模态框
function hideUserCenterModal() {
    document.getElementById('user-center-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 显示会员升级模态框
function showMembershipModal() {
    // 检查用户是否已登录
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    document.getElementById('membership-modal').classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 强制显示会员升级模态框（用于过期用户等特殊情况）
function forceShowMembershipModal() {
    document.getElementById('membership-modal').classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏会员升级模态框
function hideMembershipModal(modalId) {
    if (modalId) {
        document.getElementById(modalId).classList.add('hidden');
    } else {
        document.getElementById('membership-modal').classList.add('hidden');
    }
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 滚动会员升级模态框到底部
function scrollMembershipModalToBottom() {
  
    
    const membershipModal = document.getElementById('membership-modal');
    if (!membershipModal) {
        console.error('❌ membership-modal 元素未找到');
        return;
    }
    
    const modalBody = membershipModal.querySelector('.modal-body');
    if (!modalBody) {
        console.error('❌ modal-body 元素未找到');
        return;
    }
    

    
    // 平滑滚动到底部 - 使用多种方法确保兼容性
    modalBody.scrollTo({
        top: modalBody.scrollHeight,
        behavior: 'smooth'
    });
    
    // 备用方法，如果scrollTo不工作
    modalBody.scrollTop = modalBody.scrollHeight;
    

    
    // 添加滚动提示效果
    const contactSection = modalBody.querySelector('.contact-section');
    if (contactSection) {
  
        // 移除可能存在的高亮类
        contactSection.classList.remove('highlight-contact');
        
        // 延迟添加高亮效果，确保滚动完成后执行
        setTimeout(() => {
            contactSection.classList.add('highlight-contact');
       
            
            // 2秒后移除高亮效果
            setTimeout(() => {
                contactSection.classList.remove('highlight-contact');
             
            }, 2000);
        }, 800);
    } else {
        console.warn('⚠️ contact-section 元素未找到');
    }
}

// 显示登录表单
function showLoginForm() {
    document.getElementById('auth-title').textContent = '用户登录';
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
}

// 显示注册表单
function showRegisterForm() {
    document.getElementById('auth-title').textContent = '用户注册';
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showMessage('请输入邮箱和密码', 'error');
        return;
    }
    
    showLoading('正在登录...');
    
    try {
        const result = await window.leanCloudClient.loginUser(email, password);
        
                if (result.success) {

            
            // ✅ 设置用户数据（过期用户已在leancloud-client.js中被拒绝登录）
            currentUser = result.user;
     
            
            // 备注：过期检查已在leancloud-client.js的loginUser中处理
            // 只有非过期用户才能成功登录到这里
            
            // 同步云端统计数据到本地全局变量
            if (currentUser.statistics) {
                statistics = { ...statistics, ...currentUser.statistics };
            }
            
            updateUserInterface();
            
            // 启动会员状态定期检查
            startMembershipStatusCheck();
            
            // 🔐 启动会话检查（仅VIP/SVIP用户）
            startSessionCheck();
            
            hideAuthModal();
            showMessage('登录成功', 'success');
            
            // 检查是否需要显示科目选择
            checkSubjectSelection();
            
            // 登录成功后自动显示通知（如果用户没有设置不再提醒且不是SSSVIP用户）
            if (window.noticeManager && currentUser.membershipType?.toUpperCase() !== 'SSSVIP') {
                window.noticeManager.showNoticeOnLogin();
            }
            
            // 隐藏活动和通知按钮（SSSVIP用户）
            setTimeout(() => {
                updateActivityNoticeVisibility();
            }, 100);
          
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showMessage('登录失败，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 更新邮箱地址
function updateEmailAddress() {
    const username = document.getElementById('register-username').value.trim();
    const domain = document.getElementById('email-domain').value;
    const emailField = document.getElementById('register-email');
    
    if (username && domain) {
        emailField.value = `${username}@${domain}`;
    } else {
        emailField.value = '';
    }
}

// 获取完整邮箱地址
function getFullEmailAddress() {
    updateEmailAddress(); // 确保邮箱地址是最新的
    return document.getElementById('register-email').value.trim();
}

// 发送验证码
async function handleSendVerificationCode() {
    const email = getFullEmailAddress();
    const sendBtn = document.getElementById('send-code-btn');
    
    // 防止重复点击
    if (sendBtn.disabled) {
        return;
    }
    
    if (!email) {
        const username = document.getElementById('register-username').value.trim();
        const domain = document.getElementById('email-domain').value;
        
        if (!username) {
            showMessage('请输入邮箱@前面部分', 'error');
            document.getElementById('register-username').focus();
        } else if (!domain) {
            showMessage('请选择邮箱后缀', 'error');
            document.getElementById('email-domain').focus();
        } else {
            showMessage('请完整填写邮箱信息', 'error');
        }
        return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('邮箱格式不正确', 'error');
        document.getElementById('register-username').focus();
        return;
    }
    
    // 禁用按钮并显示加载状态
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中...';
    
    try {
        const result = await window.leanCloudClient.sendVerificationCode(email);
        
        if (result.success) {
            showMessage(result.message, 'success');
            
            // 开始倒计时
            startCodeCountdown();
        } else {
            showMessage(result.message, 'error');
            // 恢复按钮状态
            sendBtn.disabled = false;
            sendBtn.textContent = '发送验证码';
        }
    } catch (error) {
        console.error('发送验证码失败:', error);
        showMessage('发送验证码失败，请重试', 'error');
        // 恢复按钮状态
        sendBtn.disabled = false;
        sendBtn.textContent = '发送验证码';
    }
}

// 验证码倒计时
function startCodeCountdown() {
    const sendBtn = document.getElementById('send-code-btn');
    let countdown = 60;
    
    sendBtn.disabled = true;
    sendBtn.classList.add('countdown');
    
    const timer = setInterval(() => {
        sendBtn.textContent = `${countdown}秒后重发`;
        countdown--;
        
        if (countdown < 0) {
            clearInterval(timer);
            sendBtn.disabled = false;
            sendBtn.textContent = '发送验证码';
            sendBtn.classList.remove('countdown');
        }
    }, 1000);
}

// 重置密码验证码倒计时
function startResetCodeCountdown() {
    const sendBtn = document.getElementById('send-reset-code-btn');
    let countdown = 60;
    
    sendBtn.disabled = true;
    sendBtn.classList.add('countdown');
    
    const timer = setInterval(() => {
        sendBtn.textContent = `${countdown}秒后重发`;
        countdown--;
        
        if (countdown < 0) {
            clearInterval(timer);
            sendBtn.disabled = false;
            sendBtn.textContent = '发送验证码';
            sendBtn.classList.remove('countdown');
        }
    }, 1000);
}

// 处理注册（使用验证码）
async function handleRegister(e) {
    e.preventDefault();
    
    // 防止重复提交
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) {
        return;
    }
    
    const email = getFullEmailAddress();
    const code = document.getElementById('verification-code').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // 详细检查各个字段
    const username = document.getElementById('register-username').value.trim();
    const domain = document.getElementById('email-domain').value;
    
    if (!username) {
        showMessage('请输入邮箱@前面部分', 'error');
        document.getElementById('register-username').focus();
        return;
    }
    
    if (!domain) {
        showMessage('请选择邮箱后缀', 'error');
        document.getElementById('email-domain').focus();
        return;
    }
    
    if (!code) {
        showMessage('请输入验证码', 'error');
        document.getElementById('verification-code').focus();
        return;
    }
    
    if (!password) {
        showMessage('请输入密码', 'error');
        document.getElementById('register-password').focus();
        return;
    }
    
    if (!confirmPassword) {
        showMessage('请输入确认密码', 'error');
        document.getElementById('confirm-password').focus();
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('密码长度至少6位', 'error');
        return;
    }
    
    // 验证验证码格式
    if (!/^\d{6}$/.test(code)) {
        showMessage('验证码格式不正确，请输入6位数字', 'error');
        document.getElementById('verification-code').focus();
        return;
    }
    
    showLoading('正在注册...');
    
    try {
        const result = await window.leanCloudClient.registerUserWithCode(email, code, password);
        
        if (result.success) {
            showMessage('注册成功，请登录', 'success');
            // 后台发欢迎邮件，不阻塞UI
            fetch(`https://mail.aili.site/api/send-welcome`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            }).catch(() => {});
            showLoginForm();
            // 自动填入邮箱
            document.getElementById('login-email').value = email;
            // 清空注册表单
            document.getElementById('register-form').reset();
            // 清空隐藏的邮箱字段
            document.getElementById('register-email').value = '';
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('注册失败:', error);
        showMessage('注册失败，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// ========== 忘记密码功能 ==========

// 显示忘记密码模态框
function showForgotPasswordModal() {
    // 隐藏登录模态框
    hideAuthModal();
    
    // 重置忘记密码表单
    document.getElementById('forgot-password-form').reset();
    
    // 显示忘记密码模态框
    document.getElementById('forgot-password-modal').classList.remove('hidden');
    
    // 聚焦到邮箱输入框
    document.getElementById('forgot-email').focus();
    
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏忘记密码模态框
function hideForgotPasswordModal() {
    document.getElementById('forgot-password-modal').classList.add('hidden');
    document.getElementById('forgot-password-form').reset();
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 发送重置密码验证码
async function handleSendResetCode() {
    const email = document.getElementById('forgot-email').value.trim();
    const sendBtn = document.getElementById('send-reset-code-btn');
    
    // 防止重复点击
    if (sendBtn.disabled) {
        return;
    }
    
    if (!email) {
        showMessage('请输入邮箱地址', 'error');
        document.getElementById('forgot-email').focus();
        return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('邮箱格式不正确', 'error');
        document.getElementById('forgot-email').focus();
        return;
    }
    
    // 禁用按钮并显示加载状态
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中...';
    
    try {
        const result = await window.leanCloudClient.sendResetPasswordCode(email);
        
        if (result.success) {
            showMessage(result.message, 'success');
            // 开始倒计时
            startResetCodeCountdown();
        } else {
            showMessage(result.message, 'error');
            // 恢复按钮状态
            sendBtn.disabled = false;
            sendBtn.textContent = '发送验证码';
        }
    } catch (error) {
        console.error('发送重置密码验证码失败:', error);
        showMessage('发送验证码失败，请重试', 'error');
        // 恢复按钮状态
        sendBtn.disabled = false;
        sendBtn.textContent = '发送验证码';
    }
}

// 处理密码重置
async function handleResetPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value.trim();
    const code = document.getElementById('forgot-verification-code').value.trim();
    const newPassword = document.getElementById('forgot-new-password').value;
    const confirmPassword = document.getElementById('forgot-confirm-password').value;
    const submitBtn = document.getElementById('submit-reset-password');
    
    // 表单验证
    if (!email) {
        showMessage('请输入邮箱地址', 'error');
        document.getElementById('forgot-email').focus();
        return;
    }
    
    if (!code) {
        showMessage('请输入验证码', 'error');
        document.getElementById('forgot-verification-code').focus();
        return;
    }
    
    if (!newPassword) {
        showMessage('请输入新密码', 'error');
        document.getElementById('forgot-new-password').focus();
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage('密码长度至少6位', 'error');
        document.getElementById('forgot-new-password').focus();
        return;
    }
    
    if (!confirmPassword) {
        showMessage('请确认新密码', 'error');
        document.getElementById('forgot-confirm-password').focus();
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
        return;
    }
    
    // 验证验证码格式
    if (!/^\d{6}$/.test(code)) {
        showMessage('验证码格式不正确，请输入6位数字', 'error');
        document.getElementById('forgot-verification-code').focus();
        return;
    }
    
    // 禁用提交按钮
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 重置中...';
    
    showLoading('正在重置密码...');
    
    try {
        const result = await window.leanCloudClient.resetPassword(email, code, newPassword);
        
        if (result.success) {
            showMessage('密码重置成功！请使用新密码登录', 'success');
            
            // 关闭忘记密码模态框
            hideForgotPasswordModal();
            
            // 打开登录模态框并自动填入邮箱
            setTimeout(() => {
                showAuthModal();
                document.getElementById('login-email').value = email;
                document.getElementById('login-password').focus();
            }, 500);
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('重置密码失败:', error);
        showMessage('重置密码失败，请重试', 'error');
    } finally {
        hideLoading();
        // 恢复提交按钮
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> 确认重置';
    }
}

// 处理登出
async function handleLogout() {
    try {
        // 🔧 先关闭个人中心窗口
        hideUserCenterModal();
        
        // 执行实际的登出操作
        await performLogout();
        
    } catch (error) {
        console.error('登出失败:', error);
        // 即使登出失败，也要清理用户数据
        await performLogout(true); // 强制退出
    }
}

// 实际执行登出操作
async function performLogout(isForced = false) {
    try {
        const result = await window.leanCloudClient.logoutUser();
        
        if (result.success || isForced) {
            currentUser = null;
            
            // 停止会员状态定期检查
            stopMembershipStatusCheck();
            
            // 🔐 停止会话检查
            stopSessionCheck();
            
            // 🔧 清理所有科目的考试记录会话
            clearAllExamQuestionHistory();
            
            // 🔧 只删除examUser，保留其他本地存储
            localStorage.removeItem('examUser');
            
            // 重置统计数据为本地数据
            const localStats = getUserStatistics();
            statistics = {
                totalAnswered: localStats.total || 0,
                totalCorrect: localStats.correct || 0,
                correctRate: localStats.correctRate || 0
            };
            
            updateUserInterface();
            // hideUserCenterModal(); // 已在handleLogout开头关闭
            showMessage(isForced ? '已强制退出登录' : '已成功退出', 'success');

        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('执行登出失败:', error);
        // 强制清理
        currentUser = null;
        localStorage.removeItem('examUser');
        // 🔧 即使出错也要清理考试记录会话
        clearAllExamQuestionHistory();
        updateUserInterface();
        showMessage('登出失败，但已清理用户数据', 'warning');
    }
}

// 🔐 修改密码相关函数

// 初始化密码切换功能
function initPasswordToggle() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('toggle-password-btn')) {
            
            const btn = e.target.classList.contains('toggle-password-btn') ? e.target : e.target.parentElement;
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        }
    });
    
    // 密码强度检测
    document.addEventListener('input', function(e) {
        if (e.target.id === 'new-password') {
            updatePasswordStrength(e.target.value);
        }
    });
}

// 显示修改密码模态框
function showChangePasswordModal() {
    if (!currentUser) {
        showMessage('请先登录', 'warning');
        return;
    }
    
    // 重置表单
    document.getElementById('change-password-form').reset();
    updatePasswordStrength('');
    
    document.getElementById('change-password-modal').classList.remove('hidden');
    document.getElementById('current-password').focus();
    
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏修改密码模态框
function hideChangePasswordModal() {
    document.getElementById('change-password-modal').classList.add('hidden');
    document.getElementById('change-password-form').reset();
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 更新密码强度指示器
function updatePasswordStrength(password) {
    const indicator = document.querySelector('.password-strength-indicator');
    const progress = document.getElementById('password-strength-progress');
    const text = document.getElementById('password-strength-text');
    
    if (!password) {
        indicator.className = 'password-strength-indicator';
        progress.style.width = '0%';
        text.textContent = '密码强度：请输入密码';
        return;
    }
    
    let score = 0;
    let feedback = [];
    
    // 长度检查
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    
    // 复杂度检查
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;
    
    let strength = '';
    let className = '';
    
    if (score < 2) {
        strength = '弱';
        className = 'strength-weak';
        feedback.push('密码强度较弱');
    } else if (score < 4) {
        strength = '一般';
        className = 'strength-fair';
        feedback.push('密码强度一般');
    } else if (score < 5) {
        strength = '良好';
        className = 'strength-good';
        feedback.push('密码强度良好');
    } else {
        strength = '强';
        className = 'strength-strong';
        feedback.push('密码强度很强');
    }
    
    indicator.className = `password-strength-indicator ${className}`;
    text.textContent = `密码强度：${strength}`;
}

// 处理修改密码表单提交
async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const submitBtn = document.getElementById('submit-change-password');
    
    // 表单验证
    if (!currentPassword) {
        showMessage('请输入当前密码', 'warning');
        return;
    }
    
    if (!newPassword) {
        showMessage('请输入新密码', 'warning');
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage('新密码长度不能少于6位', 'warning');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage('两次输入的新密码不一致', 'warning');
        return;
    }
    
    if (currentPassword === newPassword) {
        showMessage('新密码不能与当前密码相同', 'warning');
        return;
    }
    
    // 禁用提交按钮
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 修改中...';
    
    try {
        showMessage('正在修改密码...', 'info');
        
        const result = await window.leanCloudClient.changePassword(currentPassword, newPassword);
        
        if (result.success) {
            showMessage('密码修改成功！', 'success');
            hideChangePasswordModal();
            
            // 🔐 更新本地存储的密码哈希值，防止用户数据丢失
            if (currentUser && result.newPasswordHash) {
                currentUser.passwordHash = result.newPasswordHash;
                localStorage.setItem('examUser', JSON.stringify(currentUser));
            }
            
            // 可选：提示用户重新登录
            setTimeout(() => {
                showMessage('为了安全，建议您重新登录', 'info');
            }, 2000);
        } else {
            showMessage(result.message, 'error');
        }
        
    } catch (error) {
        console.error('修改密码失败:', error);
        showMessage('修改密码失败，请稍后重试', 'error');
    } finally {
        // 恢复提交按钮
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> 确认修改';
    }
}

// 显示修改用户名模态框
function showEditUsernameModal() {
    if (!currentUser) {
        showMessage('请先登录', 'warning');
        return;
    }
    
    // 重置表单并填充当前用户名
    const form = document.getElementById('edit-username-form');
    const input = document.getElementById('new-username');
    form.reset();
    input.value = currentUser.username || '';
    
    document.getElementById('edit-username-modal').classList.remove('hidden');
    input.focus();
    // 选中输入框文字方便编辑
    input.select();
    
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏修改用户名模态框
function hideEditUsernameModal() {
    document.getElementById('edit-username-modal').classList.add('hidden');
    document.getElementById('edit-username-form').reset();
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 处理修改用户名表单提交
async function handleEditUsername(e) {
    e.preventDefault();
    
    const newUsername = document.getElementById('new-username').value.trim();
    const submitBtn = document.getElementById('submit-edit-username');
    
    // 表单验证
    if (!newUsername) {
        showMessage('请输入新用户名', 'warning');
        return;
    }
    
    if (newUsername.length < 2 || newUsername.length > 20) {
        showMessage('用户名长度应在2-20位之间', 'warning');
        return;
    }
    
    // 验证用户名格式（字母、数字、下划线、中文）
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(newUsername)) {
        showMessage('用户名只能包含字母、数字、下划线和中文', 'warning');
        return;
    }
    
    if (newUsername === currentUser.username) {
        showMessage('新用户名与当前用户名相同', 'warning');
        return;
    }
    
    // 禁用提交按钮
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 修改中...';
    
    try {
        showMessage('正在修改用户名...', 'info');
        
        const result = await window.leanCloudClient.updateUsername(newUsername);
        
        if (result.success) {
            // 更新本地用户信息
            currentUser.username = newUsername;
            localStorage.setItem('examUser', JSON.stringify(currentUser));
            
            // 更新UI显示
            updateUserInterface();
            updateStatisticsDisplay();
            
            showMessage('用户名修改成功！', 'success');
            hideEditUsernameModal();
        } else {
            showMessage(result.message, 'error');
        }
        
    } catch (error) {
        console.error('修改用户名失败:', error);
        showMessage('修改用户名失败，请稍后重试', 'error');
    } finally {
        // 恢复提交按钮
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> 确认修改';
    }
}

// 处理CDK激活
async function handleCDKActivation() {
    const cdkInput = document.getElementById('cdk-input');
    const activateBtn = document.getElementById('activate-cdk-btn');
    
    if (!cdkInput || !activateBtn) {
        console.error('CDK元素未找到');
        return;
    }
    
    const cdkCode = cdkInput.value.trim();
    
    // 输入验证
    if (!cdkCode) {
        showMessage('请输入CDK激活码', 'warning');
        cdkInput.focus();
        return;
    }
    
    if (cdkCode.length < 6 || cdkCode.length > 14) {
        showMessage('CDK激活码长度应在6-14位之间', 'warning');
        cdkInput.focus();
        return;
    }
    
    // 检查是否已登录
    if (!currentUser) {
        showMessage('请先登录后再激活CDK', 'warning');
        showAuthModal();
        return;
    }
    
    // 防止重复提交
    if (activateBtn.disabled) {
        return;
    }
    
    // 禁用按钮并显示加载状态
    activateBtn.disabled = true;
    const originalContent = activateBtn.innerHTML;
    activateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 激活中...';
    
    showLoading('正在激活CDK，请稍候...');
    
    try {
        const result = await window.leanCloudClient.activateCDK(cdkCode);
        
        if (result.success) {
            showMessage('CDK激活成功！会员权限已生效', 'success');
            
            // 清空输入框
            cdkInput.value = '';
            
            // 🔒 关闭会员升级窗口和免费提示窗口
            const membershipModal = document.getElementById('membership-modal');
            const freeVersionModal = document.getElementById('free-version-modal');
            if (membershipModal) {
                membershipModal.classList.add('hidden');
            }
            if (freeVersionModal) {
                freeVersionModal.classList.add('hidden');
            }
            
            // 获取最新的用户信息
            const userResult = window.leanCloudClient.getCurrentUser();
            if (userResult.success && userResult.user) {
                currentUser = userResult.user;
                
                // 更新用户界面显示
                updateUserInterface();
                updateUserCenterContent();
                
                // 如果需要，重新启动会员状态检查
                startMembershipStatusCheck();
                
                // 🔐 启动会话检查（仅VIP/SVIP用户）
                // 注意：会话已经在activateCDK中创建，这里只需要启动检查
                startSessionCheck();
                
                // 立即弹出个人主页，1.5秒后显示恭喜消息
                // 🎉 立即弹出个人主页，展示新的会员权益
                showUserCenterModal();
                
                // 1.5秒后显示恭喜消息
                setTimeout(() => {
                    if (result.data && result.data.membershipType) {
                        // 使用返回的时间单位信息
                        const unitDisplayName = result.data.unitDisplayName || '小时';
                        showMessage(`恭喜您成为${result.data.membershipType.toUpperCase()}会员，有效期增加${result.data.membershipDays}${unitDisplayName}!`, 'success');
                    }
                }, 1500);
            }
            
        } else {
            showMessage(result.message || 'CDK激活失败', 'error');
        }
        
    } catch (error) {
        console.error('CDK激活失败:', error);
        let errorMessage = 'CDK激活失败，请稍后重试';
        
        if (error.message) {
            errorMessage = error.message;
        }
        
        showMessage(errorMessage, 'error');
    } finally {
        // 恢复按钮状态
        activateBtn.disabled = false;
        activateBtn.innerHTML = originalContent;
        hideLoading();
    }
}

// 同步数据到云端（支持按科目同步）
async function syncDataToCloud() {
    if (!currentUser) {
        showMessage('请先登录', 'error');
        return;
    }
    
    if (!requireMembership('使用数据云同步功能')) {
        return;
    }
    
    showLoading('正在同步数据...');
    
    try {
        // 初始化UserProgressAPI
        const initResult = window.userProgressAPI.init();
        if (!initResult.success) {
            throw new Error(initResult.message);
        }
        
        // 收集本地数据
        const localData = window.userProgressAPI.collectLocalDataForSync();
        
       
        
        // 检查是否有数据需要同步
        const hasLocalData = window.userProgressAPI.checkLocalDataForSync();
        
        // 调试输出检查结果
      
        
        if (!hasLocalData.hasData) {
         
            showMessage('无需同步的数据', 'info');
            return;
        }
        
        // 同步数据到云端
        const syncResult = await window.userProgressAPI.syncUserProgress(currentUser.id, localData);
        
        if (syncResult.success) {
            showMessage('数据同步成功', 'success');
        } else {
            showMessage(syncResult.message, 'error');
        }
    } catch (error) {
        console.error('同步数据失败:', error);
        showMessage('同步数据失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 从云端导入数据
async function importDataFromCloud() {
    if (!currentUser) {
        showMessage('请先登录', 'error');
        return;
    }
    
    if (!requireMembership('使用数据导入功能')) {
        return;
    }
    
    showLoading('正在导入数据...');
    
    try {
        // 初始化UserProgressAPI
        const initResult = window.userProgressAPI.init();
        if (!initResult.success) {
            throw new Error(initResult.message);
        }
        
        // 从云端导入数据
        const importResult = await window.userProgressAPI.importUserProgress(currentUser.id);
        
        if (!importResult.success) {
            throw new Error(importResult.message);
        }
        
        const cloudData = importResult.data;
        
        // 应用导入的数据到本地存储
        applyImportedDataToLocal(cloudData);
        
        // 刷新当前用户信息
        currentUser = window.leanCloudClient.getCurrentUser().user;
        updateUserCenterContent();
        
        // 刷新UI
        updateStatisticsDisplay();
        updateSubjectDisplay(); // 确保科目显示更新
        
        showMessage('数据导入成功', 'success');
    } catch (error) {
        console.error('导入数据失败:', error);
        showMessage('导入数据失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 应用导入的数据到本地存储
function applyImportedDataToLocal(cloudData) {
    try {
      
        
        // 导入进度数据（按科目存储）
        if (cloudData.progressData) {
            const progressData = cloudData.progressData;
            Object.keys(progressData).forEach(subject => {
                Object.keys(progressData[subject]).forEach(type => {
                    const key = `exam_progress_${subject}_${type}`;
                    localStorage.setItem(key, JSON.stringify(progressData[subject][type]));
                });
            });
        }
        
        // 导入错题本（按科目存储）
        if (cloudData.wrongQuestions) {
            const wrongQuestions = cloudData.wrongQuestions;
            Object.keys(wrongQuestions).forEach(subject => {
                const key = `exam_wrong_questions_${subject}`;
                localStorage.setItem(key, JSON.stringify(wrongQuestions[subject]));
            });
        }
        
        // 导入收藏（按科目存储）
        if (cloudData.favorites) {
            const favorites = cloudData.favorites;
            Object.keys(favorites).forEach(subject => {
                const key = `exam_favorites_${subject}`;
                localStorage.setItem(key, JSON.stringify(favorites[subject]));
            });
        }
        
        // 导入用户统计
        if (cloudData.userStats) {
            localStorage.setItem('exam_user_stats', JSON.stringify(cloudData.userStats));
        }
        
        // 导入考试历史数据
        if (cloudData.examHistory) {
            Object.keys(cloudData.examHistory).forEach(subject => {
                const key = `exam_history_${subject}`;
                localStorage.setItem(key, JSON.stringify(cloudData.examHistory[subject]));
            });
        }
        
        // 导入考试题目历史数据
        if (cloudData.examQuestionHistory) {
            Object.keys(cloudData.examQuestionHistory).forEach(subject => {
                Object.keys(cloudData.examQuestionHistory[subject]).forEach(type => {
                    const key = `exam_question_history_${subject}_${type}`;
                    localStorage.setItem(key, JSON.stringify(cloudData.examQuestionHistory[subject][type]));
                });
            });
        }
        
        // 导入练习错题本数据
        if (cloudData.practiceWrongQuestions) {
            Object.keys(cloudData.practiceWrongQuestions).forEach(subject => {
                Object.keys(cloudData.practiceWrongQuestions[subject]).forEach(type => {
                    const key = `practice_wrong_${subject}_${type}`;
                    localStorage.setItem(key, JSON.stringify(cloudData.practiceWrongQuestions[subject][type]));
                });
            });
        }
        
        // 导入当前科目选择
        if (cloudData.currentSubject) {
            // 保存科目到本地存储（照抄小程序使用currentSubject键）
            localStorage.setItem('currentSubject', JSON.stringify(cloudData.currentSubject));
            currentSubject = cloudData.currentSubject;
          
            
            // 强制更新UI显示并重新加载科目数据
            setTimeout(async () => {
                updateSubjectDisplay(); // 更新科目显示
                setSelectedSubject(currentSubject); // 更新UI选中状态
                
                // 重新加载新科目的题目数据
                if (currentSubject && currentSubject.name) {
                    try {
                        const result = await window.leanCloudClient.getCurrentSubjectQuestions(currentSubject);
                        if (result.success) {
                            allQuestionsData = result.data;
                            questionsData = { ...allQuestionsData };
                            calculateStatisticsFromData();
                        }
                    } catch (error) {
                        console.error('导入数据后重新加载科目题目失败:', error);
                    }
                }
                
               
            }, 100); // 稍微延迟确保DOM更新
        }
        
   
    } catch (error) {
        console.error('应用导入数据失败:', error);
        throw error;
    }
}

// 更新用户界面
function updateUserInterface() {
    const userDisplayName = document.getElementById('user-display-name');
    const userEmail = document.getElementById('user-name');
    const userMembership = document.getElementById('user-membership');
    const loginRegisterBtn = document.getElementById('login-register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const membershipBtn = document.getElementById('membership-btn');
    const importBtn = document.getElementById('import-data-btn');
    const syncBtn = document.getElementById('sync-data-btn');

    
    // 检查关键元素是否存在
    if (!userDisplayName || !userEmail || !userMembership) {
        console.error('关键用户界面元素缺失:', {
            userDisplayName: !!userDisplayName,
            userEmail: !!userEmail,
            userMembership: !!userMembership
        });
        syncThemePermissionState(false);
        return;
    }
    
    if (currentUser) {
        // 用户已登录
        userDisplayName.textContent = currentUser.username;
        userEmail.textContent = currentUser.email;
        
        // 更新会员状态显示，包含剩余时间
        let membershipText = currentUser.membershipType;
        const remainingTime = getMembershipRemainingTime();
        if (remainingTime && remainingTime !== '永久有效') {
            membershipText += ` (剩余${remainingTime})`;
        } else if (remainingTime === '永久有效') {
            membershipText += ' (永久)';
        }
        
        userMembership.textContent = membershipText;
        userMembership.className = `membership-badge ${currentUser.membershipType.toLowerCase()}`;
        
        // 安全更新按钮状态
        if (loginRegisterBtn) loginRegisterBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        
        // 显示修改密码按钮
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) changePasswordBtn.classList.remove('hidden');
        
        // 显示修改用户名按钮
        const editUsernameBtn = document.getElementById('edit-username-btn');
        if (editUsernameBtn) editUsernameBtn.classList.remove('hidden');
        
        if (membershipBtn) membershipBtn.classList.remove('hidden');
        if (importBtn) importBtn.disabled = false;
        if (syncBtn) syncBtn.disabled = false;

        
        // 更新学习统计
        displayUserStatistics();
    } else {
        // 用户未登录
        userDisplayName.textContent = '未登录';
        userEmail.textContent = '请先登录';
        userMembership.textContent = '非会员';
        userMembership.className = 'membership-badge';
        
        // 安全更新按钮状态
        if (loginRegisterBtn) loginRegisterBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        
        // 隐藏修改密码按钮
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) changePasswordBtn.classList.add('hidden');
        
        // 隐藏修改用户名按钮
        const editUsernameBtn = document.getElementById('edit-username-btn');
        if (editUsernameBtn) editUsernameBtn.classList.add('hidden');
        
        if (membershipBtn) membershipBtn.classList.add('hidden');
        if (importBtn) importBtn.disabled = true;
        if (syncBtn) syncBtn.disabled = true;

        
        // 重置统计信息
        resetUserStatistics();
    }

    syncThemePermissionState(false);
}

// 更新用户中心内容
function updateUserCenterContent() {
    if (!currentUser) return;
    
    updateUserInterface();
    displayUserStatistics();
}

// 显示用户统计信息
function displayUserStatistics() {
    if (!currentUser) return;
    
    // 优先使用 userStats，然后是 statistics
    const userStats = currentUser.userStats || {};
    const stats = currentUser.statistics || {};
    const localStats = getUserStatistics();
    
    
    // 显示总答题数和正确率，优先使用本地数据
    const totalAnswered = localStats.total || userStats.total || stats.totalAnswered || 0;
    const correctRate = localStats.correctRate || userStats.correctRate || stats.correctRate || 0;
    

    
    document.getElementById('user-total-questions').textContent = totalAnswered;
    document.getElementById('user-correct-rate').textContent = `${correctRate}%`;
    
    // 计算收藏和错题数量
    let favoritesCount = 0;
    let wrongCount = 0;
    
    // 获取本地存储的收藏和错题数据（按科目存储）
    const subjects = ['毛概', '思修', '近代史', '马原'];
    let localFavorites = {};
    let localWrongQuestions = {};
    
    subjects.forEach(subject => {
        const favoritesKey = `exam_favorites_${subject}`;
        const wrongKey = `exam_wrong_questions_${subject}`;
        
        localFavorites[subject] = JSON.parse(localStorage.getItem(favoritesKey) || '{}');
        localWrongQuestions[subject] = JSON.parse(localStorage.getItem(wrongKey) || '{}');
    });
    

    // 优先从当前变量读取，然后从本地存储，最后从用户数据读取
    const activeFavorites = favorites || localFavorites || currentUser.favorites || {};
    const activeWrongQuestions = wrongQuestions || localWrongQuestions || currentUser.wrongQuestions || {};
    
    // 处理按科目组织的数据结构
    if (activeFavorites && Object.keys(activeFavorites).length > 0) {
        // 检查是否是按科目组织的数据结构
        const isSubjectOrganized = Object.keys(activeFavorites).some(key => 
            ['毛概', '思修', '近代史', '马原'].includes(key));
        
        if (isSubjectOrganized) {
            // 按科目组织的数据
            Object.values(activeFavorites).forEach(subjectData => {
                if (subjectData && typeof subjectData === 'object') {
                    Object.values(subjectData).forEach(typeList => {
                        if (Array.isArray(typeList)) {
                            favoritesCount += typeList.length;
                        }
                    });
                }
            });
        } else {
            // 旧的数据结构
            Object.values(activeFavorites).forEach(typeList => {
                if (Array.isArray(typeList)) {
                    favoritesCount += typeList.length;
                }
            });
        }
    }
    
    if (activeWrongQuestions && Object.keys(activeWrongQuestions).length > 0) {
        // 检查是否是按科目组织的数据结构
        const isSubjectOrganized = Object.keys(activeWrongQuestions).some(key => 
            ['毛概', '思修', '近代史', '马原'].includes(key));
        
        if (isSubjectOrganized) {
            // 按科目组织的数据
            Object.values(activeWrongQuestions).forEach(subjectData => {
                if (subjectData && typeof subjectData === 'object') {
                    Object.values(subjectData).forEach(typeList => {
                        if (Array.isArray(typeList)) {
                            wrongCount += typeList.length;
                        }
                    });
                }
            });
        } else {
            // 旧的数据结构
            Object.values(activeWrongQuestions).forEach(typeList => {
                if (Array.isArray(typeList)) {
                    wrongCount += typeList.length;
                }
            });
        }
    }
    

    
    document.getElementById('user-favorites-count').textContent = favoritesCount;
    document.getElementById('user-wrong-count').textContent = wrongCount;
}

// 重置用户统计信息
function resetUserStatistics() {
    document.getElementById('user-total-questions').textContent = '0';
    document.getElementById('user-correct-rate').textContent = '0%';
    document.getElementById('user-favorites-count').textContent = '0';
    document.getElementById('user-wrong-count').textContent = '0';
}



// 获取指定科目的进度数据
// 注意：此函数已被合并到上面的getProgressData()函数，此处删除以避免重复定义
// function getProgressData(subject) { ... }



// 更新活动和通知按钮显示状态
function updateActivityNoticeVisibility() {
    const activityBtn = document.getElementById('activity-btn');
    const noticeBtn = document.getElementById('notice-btn');
    
    if (currentUser && currentUser.membershipType?.toUpperCase() === 'SSSVIP') {
        // SSSVIP用户隐藏按钮
        if (activityBtn) activityBtn.style.display = 'none';
        if (noticeBtn) noticeBtn.style.display = 'none';
    } else {
        // 其他用户显示按钮
        if (activityBtn) activityBtn.style.display = '';
        if (noticeBtn) noticeBtn.style.display = '';
    }
}

// 控制用户中心按钮显示（仅首页显示）
function updateUserCenterVisibility() {
    const userCenterBtn = document.getElementById('user-center-btn');
    const isHomePage = document.getElementById('welcome-section').style.display !== 'none' &&
                      document.getElementById('question-type-section').style.display !== 'none';
    
    if (isHomePage) {
        userCenterBtn.classList.remove('hidden');
    } else {
        userCenterBtn.classList.add('hidden');
    }
}

// 重写返回首页函数，添加用户中心按钮控制
const originalReturnToHome = returnToHome;
returnToHome = function() {
    originalReturnToHome();
    updateUserCenterVisibility();
};

// 在系统初始化时启动用户系统
const originalInitSystem = initSystem;
initSystem = async function() {
    await originalInitSystem();
    await initUserSystem();
};


// 显示重置记录确认对话框
function showResetRecordsConfirmModal() {
    document.getElementById('reset-confirm-modal').classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏重置记录确认对话框
function hideResetConfirmModal() {
    document.getElementById('reset-confirm-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 显示重置成功对话框
function showResetSuccessModal() {
    document.getElementById('reset-success-modal').classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 隐藏重置成功对话框
function hideResetSuccessModal() {
    document.getElementById('reset-success-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 确认执行重置操作
function confirmResetRecords() {
    hideResetConfirmModal();
    resetUserRecords();
}

// 初始化重置对话框的事件监听器
function initResetDialogListeners() {
    // 点击外部关闭重置确认对话框
    document.getElementById('reset-confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideResetConfirmModal();
        }
    });
    
    // 点击外部关闭重置成功对话框
    document.getElementById('reset-success-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideResetSuccessModal();
        }
    });
}

// 重置用户记录（保留examUser）
function resetUserRecords() {
    try {

        
        // 保存当前的examUser和appVersion
        const examUser = localStorage.getItem('examUser');
        const appVersion = localStorage.getItem('appVersion');
   
        
      
        // 获取所有需要清理的存储项
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // 保留examUser和appVersion
            if (key && key !== 'examUser' && key !== 'appVersion') {
                keysToRemove.push(key);
            }
        }
        

        
        // 清理存储项
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
 
        });
        
        // 恢复examUser和appVersion
        if (examUser) {
            localStorage.setItem('examUser', examUser);
        }
        if (appVersion) {
            localStorage.setItem('appVersion', appVersion);
        }
        
        // 重置内存中的数据
        questionsData = {};
        currentQuestions = [];
        currentQuestionIndex = 0;
        currentQuestionType = '';
        userAnswers = [];
        judgedAnswers = [];
        favorites = {};
        wrongQuestions = {};
        statistics = {
            total: 0,
            single_choice: 0,
            multiple_choice: 0,
            true_false: 0,
            fill_blank: 0,
            totalAnswered: 0,
            totalCorrect: 0,
            correctRate: 0
        };
        
        
        

        
        // 显示成功提示并刷新页面
        showResetSuccessModal();
        
        // 刷新页面以更新UI
        setTimeout(() => {
            window.location.reload();
        }, 3000);
        
    } catch (error) {
        console.error('❌ 重置用户记录失败:', error);
        alert('重置失败，请稍后再试。');
    }
}

// ========== 科目管理功能 ==========

// 科目映射（动态从 SubjectAPI 加载）
let SUBJECT_CATEGORIES = {
    '毛概': '毛概',
    '思修': '思修', 
    '近代史': '近代史',
    '马原': '马原'
};

// 从 SubjectAPI 加载科目映射
async function loadSubjectCategories() {
    try {
        // 使用 leanCloudClient 的 enabledSubjects（而不是 subjectAPI）
        if (window.leanCloudClient && window.leanCloudClient.enabledSubjects) {
            const subjects = window.leanCloudClient.enabledSubjects;
            SUBJECT_CATEGORIES = {};
            subjects.forEach(subject => {
                SUBJECT_CATEGORIES[subject.name] = subject.displayName || subject.name;
            });
          
        }
    } catch (error) {
        console.error('加载科目映射失败:', error);
    }
}

function parseSubjectValue(subjectValue) {
    if (!subjectValue) {
        return null;
    }

    if (typeof subjectValue === 'object') {
        return subjectValue;
    }

    if (typeof subjectValue === 'string') {
        try {
            const parsedSubject = JSON.parse(subjectValue);
            if (parsedSubject && typeof parsedSubject === 'object') {
                return parsedSubject;
            }
        } catch (e) {
            // 兼容旧版仅保存科目名称的情况
        }

        return { name: subjectValue };
    }

    return null;
}

function getMatchedEnabledSubject(subjectValue) {
    if (!enabledSubjects || enabledSubjects.length === 0) {
        return null;
    }

    const parsedSubject = parseSubjectValue(subjectValue);
    if (!parsedSubject || !parsedSubject.name) {
        return null;
    }

    return enabledSubjects.find(subject => subject.name === parsedSubject.name) || null;
}

// 加载当前科目选择
function loadCurrentSubject() {
    const savedSubject = localStorage.getItem('currentSubject');

    const matchedSubject = getMatchedEnabledSubject(savedSubject);

    if (matchedSubject) {
        currentSubject = matchedSubject;
        localStorage.setItem('currentSubject', JSON.stringify(matchedSubject));
    } else {
        // 没有保存的科目或科目已被禁用，选择第一个启用的科目
        if (enabledSubjects && enabledSubjects.length > 0) {
            currentSubject = enabledSubjects[0];
        } else {
            currentSubject = { name: '毛概', displayName: '毛概' };
        }
    }

    updateSubjectDisplay();
    return currentSubject;
}

// 保存当前科目选择
function saveCurrentSubject(subject) {
    const matchedSubject = getMatchedEnabledSubject(subject) || parseSubjectValue(subject);
    if (!matchedSubject || !matchedSubject.name) {
        return;
    }

    currentSubject = matchedSubject;
    // 保存完整的科目对象（JSON格式）
    localStorage.setItem('currentSubject', JSON.stringify(matchedSubject));
    updateSubjectDisplay();
}

// 更新科目显示
function updateSubjectDisplay() {
    const subjectText = document.getElementById('current-subject-text');
    if (subjectText && currentSubject) {
        // 显示科目名称（name）
        subjectText.textContent = currentSubject.name || currentSubject;
    }
}

// 根据科目过滤题目
function filterQuestionsBySubject() {
    if (!currentSubject) {
        // 没有选择科目，清空题目数据
        questionsData = {};
        return;
    }
    
    // 按科目过滤
    questionsData = {};
    Object.keys(allQuestionsData).forEach(type => {
        questionsData[type] = allQuestionsData[type].filter(question => 
            question.category === (currentSubject.name || currentSubject)
        );
    });
}

// 获取各科目的题目数量统计
function getSubjectStatistics() {
    const stats = {};
    
    // 从 enabledSubjects 全局变量获取启用的科目列表
    if (enabledSubjects && enabledSubjects.length > 0) {
        enabledSubjects.forEach(subject => {
            stats[subject.name] = 0;
        });
    } else {
        // 预设默认科目
        stats['毛概'] = 0;
        stats['思修'] = 0;
        stats['近代史'] = 0;
        stats['马原'] = 0;
    }
    
    // 统计各科目题目数量
    Object.keys(allQuestionsData).forEach(type => {
        if (!allQuestionsData[type]) return; // 跳过空题型
        
        allQuestionsData[type].forEach(question => {
            // 确保题目有 category 字段
            if (question && question.category) {
                // 只统计已知科目的题目
                if (stats[question.category] !== undefined) {
                    stats[question.category]++;
                } else {
                    // 如果题目的科目不在stats中，添加它
                    stats[question.category] = 1;
                }
            }
        });
    });
    
    return stats;
}

// 处理科目选择器点击
function handleSubjectSelectorClick() {
    // 检查用户是否已登录
    if (!currentUser) {
        // 调用已有的登录提示函数
        if (window.showLoginRequiredModal) {
            window.showLoginRequiredModal();
        } else {
            showMessage('请先登录后再选择科目', 'warning');
        }
        return;
    }
    
    // 用户已登录，显示科目选择模态框
    showSubjectSelectorModal(false);
}

// 显示科目选择模态框
function showSubjectSelectorModal(isRequired = false) {
    const modal = document.getElementById('subject-selector-modal');
    const closeBtn = document.getElementById('close-subject-selector');
    
    // 动态生成科目选项
    renderSubjectOptions();
    
    // 更新题目数量统计
    updateSubjectCounts();
    
    // 设置当前选中的科目
    if (currentSubject) {
        setSelectedSubject(currentSubject);
    } else {
        // 如果没有当前科目，默认选择第一个启用的科目
        if (enabledSubjects && enabledSubjects.length > 0) {
            setSelectedSubject(enabledSubjects[0].name);
        }
    }
    
    // 根据是否必需设置关闭按钮的显示状态
    if (isRequired) {
        closeBtn.classList.add('hidden');
        // 必须选择时，禁止点击外部关闭
        modal.setAttribute('data-required', 'true');
    } else {
        closeBtn.classList.remove('hidden');
        modal.removeAttribute('data-required');
    }
    
    modal.classList.remove('hidden');
    // 打开模态框时限制页面滚动，防止移动端滑动时出现白色区域
    document.body.classList.add('modal-open');
}

// 动态渲染科目选项
function renderSubjectOptions() {
    const container = document.querySelector('.subject-options');
    if (!container) {
        return;
    }
    
    // 清空现有选项
    container.innerHTML = '';
    
    // 使用全局变量 enabledSubjects
    if (enabledSubjects && enabledSubjects.length > 0) {
        enabledSubjects.forEach(subject => {
            const option = document.createElement('div');
            option.className = 'subject-option';
            option.setAttribute('data-subject', JSON.stringify(subject));
            
            const subjectId = getSubjectId(subject.name);
            
            option.innerHTML = `
                <div class="subject-icon">${subject.icon || '📚'}</div>
                <div class="subject-info">
                    <h3>${subject.name}</h3>
                    <p>${subject.displayName || subject.name}</p>
                    <span class="subject-count" id="${subjectId}-count">题目加载中</span>
                </div>
            `;
            
            container.appendChild(option);
        });
    }
}

// 隐藏科目选择模态框
function hideSubjectSelectorModal() {
    document.getElementById('subject-selector-modal').classList.add('hidden');
    // 隐藏模态框时移除页面滚动限制
    document.body.classList.remove('modal-open');
}

// 更新科目题目数量显示（简化版，不显示具体数量）
function updateSubjectCounts() {
    // 移除题目数量统计显示，改为统一提示
    const allCountElements = document.querySelectorAll('.subject-count');
    allCountElements.forEach(element => {
        element.textContent = '题目就绪';
    });
}

// 根据科目名生成 ID（用于 DOM 元素）
function getSubjectId(subjectName) {
    // 使用简单的字符编码方式生成唯一且稳定的ID
    // 这样无论什么科目名都能正确处理，不需要维护映射表
    
    // 方案：将科目名转换为安全的ID字符串
    // 1. 对于纯英文/数字，转小写并移除特殊字符
    // 2. 对于中文或混合，使用字符码生成唯一ID
    
    let safeId = '';
    
    // 先尝试提取英文和数字字符
    const alphanumeric = subjectName.replace(/[^a-zA-Z0-9]/g, '');
    
    if (alphanumeric.length >= 2) {
        // 如果有足够的英文/数字字符，使用它们
        safeId = alphanumeric.toLowerCase();
    } else {
        // 否则使用字符码生成唯一ID（先生成完整码，再添加前缀和截断）
        const charCodes = Array.from(subjectName)
            .map(char => char.charCodeAt(0))
            .join('');
        
        // 截断到合理长度（20位足够保证唯一性）
        safeId = 'subject-' + charCodes.substring(0, 20);
    }
    
    return safeId;
}

// 设置选中的科目
function setSelectedSubject(subject) {
    const targetSubject = getMatchedEnabledSubject(subject) || parseSubjectValue(subject);
    if (!targetSubject || !targetSubject.name) {
        return;
    }

    // 清除之前的选择
    document.querySelectorAll('.subject-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // 遍历所有选项找到匹配的科目
    let foundOption = null;
    document.querySelectorAll('.subject-option').forEach(option => {
        try {
            const optionSubject = JSON.parse(option.dataset.subject);
            if (optionSubject.name === targetSubject.name) {
                foundOption = option;
            }
        } catch (e) {
            // 如果解析失败，跳过
        }
    });
    
    if (foundOption) {
        foundOption.classList.add('selected');
        selectedSubjectOption = foundOption;
        
        // 启用确认按钮
        document.getElementById('confirm-subject-selection').disabled = false;
    }
    
    // 添加点击事件监听
    document.querySelectorAll('.subject-option').forEach(option => {
        option.addEventListener('click', () => {
            // 清除之前的选择
            document.querySelectorAll('.subject-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // 设置新的选择
            option.classList.add('selected');
            selectedSubjectOption = option;
            
            // 启用确认按钮
            document.getElementById('confirm-subject-selection').disabled = false;
        });
    });
}

// 确认科目选择
async function confirmSubjectSelection() {
    if (!selectedSubjectOption) return;
    
    const newSubjectObj = JSON.parse(selectedSubjectOption.dataset.subject);
    const newSubject = newSubjectObj;
    
    // 更新当前科目并持久化
    saveCurrentSubject(newSubjectObj);
    
    // 加载新科目的题目数据
    try {
        showLoading('正在加载新科目题目...');
        
        // 使用新的方法加载新科目的题目
        const result = await window.leanCloudClient.getCurrentSubjectQuestions(newSubjectObj);
        if (!result.success) {
            throw new Error(result.message);
        }
        
        allQuestionsData = result.data;
        questionsData = { ...allQuestionsData };
        
        // 重新计算统计信息
        calculateStatisticsFromData();
        
        updateStatus('已连接服务器', 'connected');
        
        // 更新UI
        updateUI();
        
        hideLoading();
        
    } catch (error) {
        console.error('加载新科目题目失败:', error);
        showMessage(`加载 ${newSubjectObj.name} 科目题目失败：${error.message}`, 'error');
        hideLoading();
    }
    
    // 隐藏模态框
    hideSubjectSelectorModal();
    
    // 显示成功消息（使用 displayName）
    const displayName = newSubject.displayName || newSubject.name || '未知科目';
    showMessage(`已切换到：${displayName}`, 'success');
}

// 检查是否需要显示科目选择（用户登录后）
function checkSubjectSelection() {
    // 只为已登录用户检查科目选择
    if (!currentUser) {
        return false; // 未登录用户不需要选择
    }
    
    // 检查保存的科目是否有效
    const savedSubject = localStorage.getItem('currentSubject');
    const isValidSubject = !!getMatchedEnabledSubject(savedSubject);
    
    // 如果没有保存的科目或科目已被禁用，必须显示科目选择模态框
    if (!savedSubject || !isValidSubject) {
        setTimeout(() => {
            showSubjectSelectorModal(true); // 传入true表示必须选择
            showMessage('请选择您要学习的科目类型', 'info');
        }, 1000);
        return true; // 需要选择科目
    }
    return false; // 不需要选择科目
}

// 显示科目按钮
function showSubjectButton() {
    const subjectBtn = document.getElementById('subject-selector-btn');
    if (subjectBtn) {
        subjectBtn.style.display = '';
    }
}

// 隐藏科目按钮
function hideSubjectButton() {
    const subjectBtn = document.getElementById('subject-selector-btn');
    if (subjectBtn) {
        subjectBtn.style.display = 'none';
    }
}



// ==================== 考试记录功能 ====================

// 获取考试记录存储键
function getExamHistoryKey(subject) {
    return `exam_history_${subject}`;
}

// 获取考试记录
function getExamHistory(subject) {
    const key = getExamHistoryKey(subject);
    const historyJson = localStorage.getItem(key);
    if (historyJson) {
        try {
            return JSON.parse(historyJson);
        } catch (e) {
            return [];
        }
    }
    return [];
}

// 保存考试记录
function saveExamRecord(subject, record) {
    const key = getExamHistoryKey(subject);
    const history = getExamHistory(subject);
    
    // 添加新记录到开头
    history.unshift(record);
    
    // 最多保留20条记录
    if (history.length > 20) {
        history.splice(20);
    }
    
    localStorage.setItem(key, JSON.stringify(history));
}

// 清空考试记录
function clearExamHistory() {
    // 显示自定义确认对话框
    document.getElementById('clear-exam-history-modal').classList.remove('hidden');
    document.body.classList.add('modal-open');
}

// 隐藏清空考试记录确认对话框
function hideClearExamHistoryModal() {
    document.getElementById('clear-exam-history-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// 确认清空考试记录
function confirmClearExamHistory() {
    hideClearExamHistoryModal();
    
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    const key = getExamHistoryKey(subjectKey);
    localStorage.removeItem(key);
    renderExamHistory();
    showMessage('考试记录已清空', 'success');
}

// 渲染考试记录列表
function renderExamHistory() {
    const container = document.getElementById('exam-history-list');
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    const history = getExamHistory(subjectKey);
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="exam-history-empty">
                <i class="fas fa-clipboard-list"></i>
                <p>暂无考试记录</p>
                <p style="font-size: 12px; margin-top: 8px;">完成模拟考试后，记录将显示在这里</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = history.map((record, index) => {
        const scoreClass = getScoreClass(record.score);
        const dateStr = formatExamDate(record.date);
        const timeStr = formatExamTime(record.usedTime);
        const hasDetail = record.questions && record.questions.length > 0;
        
        return `
            <div class="exam-history-item">
                <div class="exam-history-item-header">
                    <span class="exam-history-date">
                        <i class="fas fa-calendar-alt"></i>
                        ${dateStr}
                    </span>
                    <span class="exam-history-score ${scoreClass}">${record.score}分</span>
                </div>
                <div class="exam-history-stats">
                    <span class="exam-history-stat">
                        <i class="fas fa-list-ol"></i>
                        共${record.totalCount}题
                    </span>
                    <span class="exam-history-stat">
                        <i class="fas fa-check"></i>
                        对${record.correctCount}题
                    </span>
                    <span class="exam-history-stat">
                        <i class="fas fa-times"></i>
                        错${record.wrongCount}题
                    </span>
                    <span class="exam-history-stat">
                        <i class="fas fa-clock"></i>
                        ${timeStr}
                    </span>
                </div>
                ${hasDetail ? `
                <div class="exam-history-actions">
                    <button class="exam-history-detail-btn" onclick="viewExamDetail(${index})">
                        <i class="fas fa-eye"></i>
                        <span>查看详情</span>
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// 获取分数等级样式类
function getScoreClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 60) return 'pass';
    return 'fail';
}

// 格式化考试日期
function formatExamDate(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
}

// 格式化考试用时
function formatExamTime(seconds) {
    if (!seconds || seconds <= 0) return '未知';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
        return `${minutes}分${secs}秒`;
    }
    return `${secs}秒`;
}


// 查看考试详情
function viewExamDetail(recordIndex) {
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    const history = getExamHistory(subjectKey);
    
    if (!history[recordIndex] || !history[recordIndex].questions) {
        showMessage('该记录没有详细信息', 'warning');
        return;
    }
    
    const record = history[recordIndex];
    
    // 关闭考试配置模态框
    hideExamConfigModal();
    
    // 加载历史记录的题目
    currentQuestions = record.questions.map(q => ({
        title: q.title,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        _type: q.type,
        source: q.source
    }));
    
    // 恢复用户答案
    userAnswers = record.questions.map(q => q.userAnswer);
    
    // 标记所有题目为已评判
    judgedAnswers = record.questions.map(() => true);
    
    currentQuestionIndex = 0;
    isExamMode = true;
    isReviewMode = true;
    
    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    
    // 隐藏科目按钮
    hideSubjectButton();
    
    // 禁用提交按钮
    document.getElementById('submit-btn').disabled = true;
    
    // 移动端处理
    toggleMobileFavoriteButton(true);
    if (window.innerWidth <= 768) {
        const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
        if (mobileBottomNav) mobileBottomNav.style.display = 'none';
    }
    
    // 隐藏顶部导航按钮
    document.getElementById('home-btn').style.display = 'none';
    document.getElementById('wrong-questions-btn').style.display = 'none';
    document.getElementById('favorites-btn').style.display = 'none';
    
    // 显示考试导航栏
    const examNav = document.getElementById('exam-nav');
    examNav.classList.remove('hidden');
    updateExamNavigation();
    
    showQuestion();
    
    const dateStr = formatExamDate(record.date);
    showMessage(`正在查看 ${dateStr} 的考试记录`, 'info');
}


// ========== 临时错题练习本功能（仿小程序实现）==========

// 加载临时错题练习本（本地存储）
function loadPracticeWrongQuestions(type) {
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    const key = `practice_wrong_${subjectKey}_${type}`;
    const storedData = localStorage.getItem(key);
    
    if (storedData) {
        try {
            return JSON.parse(storedData);
        } catch (e) {
            console.warn(`解析${key}临时错题数据失败:`, e);
            return [];
        }
    }
    return [];
}

// 保存临时错题练习本（本地存储）
function savePracticeWrongQuestions(wrongList, type) {
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    const key = `practice_wrong_${subjectKey}_${type}`;
    localStorage.setItem(key, JSON.stringify(wrongList));
}

// 添加到临时错题练习本（答错时调用，不重复添加）
function addToPracticeWrong(question) {
    const questionTypeReal = question._type || question.type || currentQuestionType;
    
    // 检查是否已存在（通过题目标题判断）
    const exists = practiceWrongQuestions.some(q => q.title === question.title);
    if (exists) return;
    
    practiceWrongQuestions.push({
        ...question, 
        _type: questionTypeReal
    });
    
    practiceWrongCount = practiceWrongQuestions.length;
    savePracticeWrongQuestions(practiceWrongQuestions, questionTypeReal);
    
    // 更新按钮状态
    updatePracticeWrongButton();
}

// 清除临时错题练习本
function clearPracticeWrongQuestions() {
    const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
    const subjectKey = (currentSubject && currentSubject.name) || '毛概';
    
    questionTypes.forEach(type => {
        const key = `practice_wrong_${subjectKey}_${type}`;
        localStorage.removeItem(key);
    });
    
    practiceWrongQuestions = [];
    practiceWrongCount = 0;
}

// 更新练习错题按钮状态
function updatePracticeWrongButton() {
    const practiceWrongBtn = document.getElementById('practice-wrong-btn');
    if (practiceWrongBtn) {
        practiceWrongBtn.textContent = `练习错题 (${practiceWrongCount}题)`;
        practiceWrongBtn.style.display = practiceWrongCount > 0 ? 'block' : 'none';
    }
}

// 练习本次错题（从临时错题练习本加载）
function practiceSessionWrongQuestions() {
    // 检查是否有错题可以练习
    if (practiceWrongQuestions.length === 0) {
        showMessage('本题型暂无错题记录', 'info');
        return;
    }
    
    // 保存当前练习状态
    savedPracticeState = {
        mode: mode,
        isExamMode: isExamMode,
        isReviewMode: isReviewMode,
        isPracticingWrongQuestions: isPracticingWrongQuestions,
        currentQuestionType: currentQuestionType,
        currentSubject: currentSubject,
        source: source
    };
    
    // 设置为练习错题模式
    isSessionWrongPractice = true;
    isPracticingWrongQuestions = true;
    mode = 'practice';
    source = 'sessionWrong';
    
    // 加载临时错题练习本
    const allTypesWrong = [];
    practiceWrongQuestions.forEach(q => {
        allTypesWrong.push(q);
    });
    
    // 设置题目
    currentQuestions = allTypesWrong;
    userAnswers = new Array(allTypesWrong.length).fill(null);
    judgedAnswers = new Array(allTypesWrong.length).fill(false);
    currentQuestionIndex = 0;
    
    // 显示题目
    displayCurrentQuestion();
    updateProgressBar();
    updateNavigationButtons();
    
    showMessage(`开始练习本次错题，共${allTypesWrong.length}道题`, 'success');
}

// 完成本次错题练习，返回普通练习
function finishSessionWrongPractice() {
    // 清除临时错题练习本
    clearPracticeWrongQuestions();
    
    // 恢复之前的练习状态
    if (savedPracticeState) {
        mode = savedPracticeState.mode;
        isExamMode = savedPracticeState.isExamMode;
        isReviewMode = savedPracticeState.isReviewMode;
        isPracticingWrongQuestions = savedPracticeState.isPracticingWrongQuestions;
        currentQuestionType = savedPracticeState.currentQuestionType;
        currentSubject = savedPracticeState.currentSubject;
        source = savedPracticeState.source;
    }
    
    // 重置标志
    isSessionWrongPractice = false;
    savedPracticeState = null;
    
    // 更新UI
    updateUI();
    updateNavigationButtons();
    
    showMessage('本次错题练习完成', 'success');
}
