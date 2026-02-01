import { supabase } from './supabase';

/**
 * Sign up a new user and create their profile
 */
export async function signUp({ email, password, username, organizationId }) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        return { error: authError.message };
    }

    // Create user profile
    const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
            id: authData.user.id,
            organization_id: organizationId,
            username,
            role: 'customer', // New signups are always customers
        });

    if (profileError) {
        return { error: profileError.message };
    }

    return { user: authData.user };
}

/**
 * Sign in existing user
 */
export async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

    if (profileError) {
        return { error: 'User profile not found' };
    }

    // Check if access is revoked
    if (profile.access_revoked) {
        await supabase.auth.signOut();
        return { error: 'Access Revoked. Please contact administrator.' };
    }

    return {
        user: {
            id: data.user.id,
            email: data.user.email,
            username: profile.username,
            type: profile.role,
            isSuperAdmin: profile.role === 'super_admin',
        }
    };
}

/**
 * Sign out current user
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message };
}

/**
 * Get current session
 */
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * Get current user with profile
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) return null;

    return {
        id: user.id,
        email: user.email,
        username: profile.username,
        type: profile.role,
        isSuperAdmin: profile.role === 'super_admin',
    };
}

/**
 * Request password reset
 */
export async function resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });

    return { error: error?.message };
}

/**
 * Update password (after reset)
 */
export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    return { error: error?.message };
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}