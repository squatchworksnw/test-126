(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Services = window.FieldOps.Services || {};

  const { VIEW_ACCESS, SUBMITTER_INSERT_TABLES } = window.FieldOps.Auth.roles;
  const SessionApi = window.FieldOps.Auth.session;
  const PASSWORD_RECOVERY_REDIRECT = "https://squatchworksnw.github.io/test-126/?mode=recovery";
  const MIN_PASSWORD_LENGTH = 8;

  function isAuthenticated(state){ return Boolean(state.currentSession?.user); }
  function workspaceId(state){ return state.currentWorkspace?.id || ""; }
  function currentRole(state){ return state.currentWorkspace?.role || ""; }
  function isOwner(state){ return currentRole(state) === "owner"; }
  function canManageOperations(state){ return ["owner","admin"].includes(currentRole(state)); }
  function canSubmitOnly(state){ return currentRole(state) === "submitter"; }

  function allowedViewsForRole(state){
    return new Set(VIEW_ACCESS[currentRole(state)] || VIEW_ACCESS["signed-out"]);
  }

  function defaultViewForRole(state){
    if(!isAuthenticated(state)) return "login";
    if(canSubmitOnly(state)) return "fieldPortal";
    if(canManageOperations(state)) return "dashboard";
    return "login";
  }

  function canAccessView(id, state){
    if(id === "accessDenied") return true;
    return allowedViewsForRole(state).has(id);
  }

  function isRecoveryUrl(){
    return new URLSearchParams(window.location.search).get("mode") === "recovery";
  }

  function passwordRecoveryModal(){
    return {
      backdrop: document.getElementById("passwordRecoveryModal"),
      message: document.getElementById("passwordRecoveryMessage"),
      newPassword: document.getElementById("newPasswordInput"),
      confirmPassword: document.getElementById("confirmPasswordInput"),
      error: document.getElementById("passwordRecoveryError")
    };
  }

  function showPasswordRecoveryPrompt(message = "Enter a new password for your account."){
    const modal = passwordRecoveryModal();
    if(!modal.backdrop) return;
    if(modal.message) modal.message.textContent = message;
    if(modal.error) modal.error.textContent = "";
    if(modal.newPassword) modal.newPassword.value = "";
    if(modal.confirmPassword) modal.confirmPassword.value = "";
    if(typeof window.openManagedModal === "function") window.openManagedModal(modal.backdrop, modal.newPassword);
    else {
      modal.backdrop.classList.add("active");
      setTimeout(() => modal.newPassword?.focus(), 50);
    }
  }

  function hidePasswordRecoveryPrompt(){
    const modal = passwordRecoveryModal();
    if(typeof window.closeManagedModal === "function") window.closeManagedModal(modal.backdrop);
    else modal.backdrop?.classList.remove("active");
    if(isRecoveryUrl()){
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  function recoveryErrorMessage(error){
    const text = String(error?.message || error || "").toLowerCase();
    if(text.includes("expired") || text.includes("invalid")) return "This reset link may have expired. Ask for a new password reset email and try again.";
    if(text.includes("weak") || text.includes("password")) return "Choose a stronger password with at least 8 characters.";
    if(text.includes("network") || text.includes("fetch")) return "The connection dropped before the password could be saved. Try again.";
    return "The password could not be updated. Ask for a new reset email and try again.";
  }

  function renderAuthState(ctx){
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const signInButton = document.getElementById("signInBtn");
    const passwordSignInButton = document.getElementById("passwordSignInBtn");
    const signOutButton = document.getElementById("signOutBtn");
    const emailLabel = document.getElementById("authUserEmail");
    const state = ctx.getState();
    const email = state.currentSession?.user?.email || "";
    const displayName = state.currentWorkspace?.displayName || "";
    emailInput.classList.toggle("hidden", Boolean(email));
    passwordInput?.classList.toggle("hidden", Boolean(email));
    signInButton.classList.toggle("hidden", Boolean(email));
    passwordSignInButton?.classList.toggle("hidden", Boolean(email));
    signOutButton.classList.toggle("hidden", !email);
    emailLabel.classList.toggle("hidden", !email);
    emailLabel.textContent = email ? `${displayName || email}${currentRole(state) ? ` - ${ctx.titleize(currentRole(state))}` : ""}` : "";
    document.body.dataset.role = currentRole(state) || "signed-out";
    document.body.dataset.auth = isAuthenticated(state) ? "signed-in" : "signed-out";
    document.body.dataset.demo = state.currentWorkspace?.isDemo ? "true" : "false";
    ctx.applyRoleVisibility();
  }

  function requireAuth(showAlert, ctx){
    const state = ctx.getState();
    if(isAuthenticated(state) && state.currentWorkspace) return true;
    ctx.setStatus(isAuthenticated(state) ? "Loading workspace" : "Sign in to load workspace");
    if(showAlert) alert(isAuthenticated(state) ? "Workspace is still loading." : "Sign in first to open this part of the workspace.");
    return false;
  }

  function requireInsertPermission(table, actionLabel, ctx){
    const state = ctx.getState();
    if(!requireAuth(true, ctx)) return false;
    if(canManageOperations(state)) return true;
    if(canSubmitOnly(state) && SUBMITTER_INSERT_TABLES.has(table)) return true;
    ctx.setStatus("Access limited by role");
    alert(`Your role can submit requests and uploads, but cannot ${actionLabel}.`);
    return false;
  }

  function requireUpdatePermission(table, actionLabel, ctx){
    if(table === "field_ops_workspaces") return requireOwnerPermission(actionLabel, ctx);
    if(requireAuth(true, ctx) && canManageOperations(ctx.getState())) return true;
    ctx.setStatus("Access limited by role");
    alert(`Owner or Admin access is required to ${actionLabel}.`);
    return false;
  }

  function requireArchivePermission(actionLabel, ctx){
    if(requireAuth(true, ctx) && canManageOperations(ctx.getState())) return true;
    ctx.setStatus("Access limited by role");
    alert(`Owner or Admin access is required to ${actionLabel}.`);
    return false;
  }

  function requireOperationsPermission(actionLabel, ctx){
    if(requireAuth(true, ctx) && canManageOperations(ctx.getState())) return true;
    ctx.setStatus("Owner or Admin required");
    alert(`Owner or Admin access is required to ${actionLabel}. Submitters can send requests through Needs Review.`);
    return false;
  }

  function requireOwnerPermission(actionLabel, ctx){
    if(requireAuth(true, ctx) && isOwner(ctx.getState())) return true;
    ctx.setStatus("Owner required");
    alert(`Owner access is required to ${actionLabel}.`);
    return false;
  }

  async function initializeAuth(ctx){
    const { data, error } = await SessionApi.getSession(ctx.supabaseClient);
    if(error) console.warn("Session check warning", error.message || error);
    ctx.setSession(data?.session || null);
    renderAuthState(ctx);

    if(isRecoveryUrl()){
      showPasswordRecoveryPrompt("Enter a new password to finish resetting your account.");
    }

    SessionApi.onAuthStateChange(ctx.supabaseClient, async (event, session) => {
      ctx.setSession(session);
      renderAuthState(ctx);
      if(event === "PASSWORD_RECOVERY"){
        showPasswordRecoveryPrompt("Enter a new password to finish resetting your account.");
        return;
      }
      if(session){
        await bootstrapWorkspace(ctx);
      } else {
        ctx.setWorkspace(null);
        Object.assign(ctx.app, ctx.createEmptyAppState());
        ctx.setStatus("Sign in to load workspace");
        ctx.render();
        ctx.showView?.("login", { skipHistory:true });
      }
    });

    if(ctx.getState().currentSession){
      await bootstrapWorkspace(ctx);
    } else {
      ctx.setStatus("Sign in to load workspace");
      ctx.render();
      ctx.showView?.("login", { skipHistory:true });
    }
  }

  async function requestPasswordReset(ctx){
    const email = (document.getElementById("loginEmail")?.value || document.getElementById("authEmail")?.value || "").trim();
    if(!email){
      alert("Enter your email first, then choose Forgot password.");
      document.getElementById("loginEmail")?.focus();
      return;
    }
    const { error } = await SessionApi.resetPasswordForEmail(ctx.supabaseClient, email, PASSWORD_RECOVERY_REDIRECT);
    if(error){
      const message = String(error.message || "").toLowerCase();
      const friendly = message.includes("rate")
        ? "Password reset emails are paused for a few minutes. Wait a bit, then try once."
        : message.includes("network") || message.includes("fetch")
          ? "The connection dropped before the reset email could be sent. Try again."
          : "Password reset email could not be sent. Check the email address and try again.";
      alert(friendly);
      return;
    }
    ctx.setStatus("Password reset email sent");
    alert("Check your email for a password reset link.");
  }

  async function saveRecoveredPassword(ctx){
    const modal = passwordRecoveryModal();
    const password = modal.newPassword?.value || "";
    const confirmPassword = modal.confirmPassword?.value || "";
    if(modal.error) modal.error.textContent = "";
    if(!password || !confirmPassword){
      if(modal.error) modal.error.textContent = "Enter the new password twice.";
      return;
    }
    if(password.length < MIN_PASSWORD_LENGTH){
      if(modal.error) modal.error.textContent = "Use at least 8 characters.";
      return;
    }
    if(password !== confirmPassword){
      if(modal.error) modal.error.textContent = "The two passwords do not match.";
      return;
    }
    try{
      const { error } = await SessionApi.updatePassword(ctx.supabaseClient, password);
      if(error) throw error;
      hidePasswordRecoveryPrompt();
      await SessionApi.signOut(ctx.supabaseClient);
      ctx.setWorkspace(null);
      ctx.setSession(null);
      ctx.setStatus("Password updated");
      ctx.showView?.("login", { skipHistory:true });
      alert("Password updated. You can sign in now.");
    }catch(err){
      console.error(err);
      if(modal.error) modal.error.textContent = recoveryErrorMessage(err);
    }
  }

  async function signInForSync(ctx){
    const email = document.getElementById("authEmail").value.trim();
    if(!email){
      alert("Enter your email to sign in.");
      return;
    }

    const { error } = await SessionApi.signInWithEmail(ctx.supabaseClient, email, window.location.href.split("#")[0]);

    if(error){
      const isRateLimited = String(error.message || "").toLowerCase().includes("rate");
      alert(isRateLimited ? "Sign-in emails are paused for a few minutes. Wait a bit, then try once." : "Sign-in failed: " + error.message);
      return;
    }
    ctx.setStatus("Check your email for sign-in link");
    alert("Check your email for the private sign-in link. After it opens, you can choose your display name.");
  }

  async function signInWithPasswordForSync(ctx){
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword")?.value || "";
    if(!email || !password){
      alert("Enter your email and account password. If you never set a password, use the email sign-in link instead.");
      return;
    }
    const { error } = await SessionApi.signInWithPassword(ctx.supabaseClient, email, password);
    if(error){
      const message = String(error.message || "");
      const lower = message.toLowerCase();
      const friendly = lower.includes("invalid login credentials")
        ? "That email/password combination did not work. If this account was created by email link, it may not have a password yet. Use Email sign-in link, or ask an admin to set a password."
        : lower.includes("email not confirmed")
          ? "This email needs to be confirmed before password sign-in will work. Use the email sign-in link first."
          : `Password sign-in failed: ${message}`;
      alert(friendly);
      return;
    }
    ctx.setStatus("Signed in. Loading workspace...");
  }

  function displayNameModal(){
    return {
      backdrop: document.getElementById("displayNameModal"),
      input: document.getElementById("displayNameInput"),
      error: document.getElementById("displayNameError")
    };
  }

  function showDisplayNamePrompt(ctx){
    const state = ctx.getState();
    if(!isAuthenticated(state) || !state.currentWorkspace || state.currentWorkspace.displayName) return;
    const modal = displayNameModal();
    if(!modal.backdrop || !modal.input) return;
    modal.input.value = "";
    if(modal.error) modal.error.textContent = "";
    if(typeof window.openManagedModal === "function") window.openManagedModal(modal.backdrop, modal.input);
    else {
      modal.backdrop.classList.add("active");
      setTimeout(() => modal.input.focus(), 50);
    }
  }

  function hideDisplayNamePrompt(){
    const modal = displayNameModal();
    if(typeof window.closeManagedModal === "function") window.closeManagedModal(modal.backdrop);
    else modal.backdrop?.classList.remove("active");
  }

  async function saveDisplayName(ctx){
    const modal = displayNameModal();
    const displayName = modal.input?.value.trim().replace(/\s+/g, " ");
    if(!displayName){
      if(modal.error) modal.error.textContent = "Choose the name you want this workspace to use.";
      return;
    }
    if(displayName.length > 32){
      if(modal.error) modal.error.textContent = "Keep it short and easy to remember.";
      return;
    }
    try{
      const userId = ctx.getState().currentSession?.user?.id;
      if(!userId) throw new Error("No signed-in user found.");
      const { data, error } = await SessionApi.saveUserProfile(ctx.supabaseClient, userId, { displayName });
      if(error) throw error;
      ctx.setWorkspace({ ...ctx.getState().currentWorkspace, displayName:data?.display_name || displayName });
      ctx.app.settings.userDisplayName = data?.display_name || displayName;
      ctx.setStatus(`Welcome, ${data?.display_name || displayName}`);
      renderAuthState(ctx);
      hideDisplayNamePrompt();
    }catch(err){
      console.error(err);
      if(modal.error) modal.error.textContent = "Display name could not be saved. Check your connection and try again.";
    }
  }

  async function signOutForSync(ctx){
    const { error } = await SessionApi.signOut(ctx.supabaseClient);
    if(error) alert("Sign-out failed: " + error.message);
  }

  async function bootstrapWorkspace(ctx){
    if(!isAuthenticated(ctx.getState())) return;
    try{
      ctx.setStatus("Loading workspace...");
      const { data, error } = await SessionApi.loadFirstWorkspace(ctx.supabaseClient);
      if(error) throw error;
      if(!data) throw new Error("No field operations workspace is assigned to this user.");

      const profileResult = await SessionApi.loadUserProfile(ctx.supabaseClient, ctx.getState().currentSession.user.id);
      if(profileResult.error) throw profileResult.error;
      const displayName = profileResult.data?.display_name || "";
      ctx.setWorkspace({ ...data, displayName });
      ctx.app.settings.workspaceName = data.name || "Field Operations Command Center";
      ctx.app.settings.workspaceNote = `Role: ${data.role || "member"}`;
      ctx.app.settings.userDisplayName = displayName;
      renderAuthState(ctx);
      await ctx.loadWorkspaceData();
      await ctx.flushPendingWrites(false);
      ctx.showView?.(defaultViewForRole(ctx.getState()), { skipHistory:true });
      showDisplayNamePrompt(ctx);
      ctx.startAutoRefresh();
    }catch(err){
      console.error(err);
      ctx.setStatus("Workspace load failed");
      alert("Workspace load failed: " + err.message);
    }
  }

  document.addEventListener?.("keydown", event => {
    if(event.key !== "Escape") return;
    if(passwordRecoveryModal().backdrop?.classList.contains("active")) hidePasswordRecoveryPrompt();
    if(displayNameModal().backdrop?.classList.contains("active")) hideDisplayNamePrompt();
  });

  document.getElementById("passwordRecoveryModal")?.addEventListener("click", event => {
    if(event.target?.id === "passwordRecoveryModal") hidePasswordRecoveryPrompt();
  });

  document.getElementById("displayNameModal")?.addEventListener("click", event => {
    if(event.target?.id === "displayNameModal") hideDisplayNamePrompt();
  });

  window.FieldOps.Services.auth = {
    isAuthenticated,
    workspaceId,
    currentRole,
    isOwner,
    canManageOperations,
    canSubmitOnly,
    allowedViewsForRole,
    defaultViewForRole,
    canAccessView,
    renderAuthState,
    requireAuth,
    requireInsertPermission,
    requireUpdatePermission,
    requireArchivePermission,
    requireOperationsPermission,
    requireOwnerPermission,
    initializeAuth,
    signInForSync,
    signInWithPasswordForSync,
    requestPasswordReset,
    saveRecoveredPassword,
    showPasswordRecoveryPrompt,
    hidePasswordRecoveryPrompt,
    signOutForSync,
    bootstrapWorkspace,
    saveDisplayName,
    showDisplayNamePrompt,
    hideDisplayNamePrompt
  };
})();
