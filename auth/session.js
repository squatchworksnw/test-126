(function(){
  window.FieldOps = window.FieldOps || {};
  window.FieldOps.Auth = window.FieldOps.Auth || {};

  function getSession(supabaseClient){
    return supabaseClient.auth.getSession();
  }

  function onAuthStateChange(supabaseClient, handler){
    return supabaseClient.auth.onAuthStateChange(handler);
  }

  function signInWithEmail(supabaseClient, email, redirectTo){
    return supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
  }

  function signInWithPassword(supabaseClient, email, password){
    return supabaseClient.auth.signInWithPassword({ email, password });
  }

  function signOut(supabaseClient){
    return supabaseClient.auth.signOut();
  }

  function loadFirstWorkspace(supabaseClient){
    return supabaseClient
      .from("field_ops_my_workspaces")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
  }

  function loadUserProfile(supabaseClient, userId){
    return supabaseClient
      .from("field_ops_user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
  }

  function saveUserProfile(supabaseClient, userId, values){
    return supabaseClient
      .from("field_ops_user_profiles")
      .upsert({
        user_id: userId,
        display_name: values.displayName,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" })
      .select("*")
      .single();
  }

  window.FieldOps.Auth.session = { getSession, onAuthStateChange, signInWithEmail, signInWithPassword, signOut, loadFirstWorkspace, loadUserProfile, saveUserProfile };
})();
