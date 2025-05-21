
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo } from '@/types';
import { format } from 'date-fns';
// import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin'; // No longer using super-admin for most actions


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  const actionName = "Validate Referral Code Action";
  if (!code || code.trim().length < 3) { // Basic check for empty or very short codes
    setReferralMessage(null); // This line will cause an error as setReferralMessage is not defined here
    setReferralMessageIsError(false); // This line will also cause an error
    return { success: false, message: "" };
  }
  const upperCaseCode = code.trim().toUpperCase();
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      // Do not return "Invalid referral code" here to allow user to proceed
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" }; // Return empty on error as well
  }
}

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const actionName = "Signup User Action";
  console.log(`[${actionName}] Attempting signup for email: ${data.email}`);
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.warn(`[${actionName}] Validation failed: ${errorMessages}`);
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { name, surname, email, phone, password, class: userClass, referralCode: referredByCodeInput } = validation.data;
  const upperCaseReferredByCode = referredByCodeInput?.trim().toUpperCase() || null;
  let newUser;

  try {
    const newUserReferralCode = generateReferralCode();
    const combinedName = `${name} ${surname}`.trim();

    const userDataForPocketBase = {
      email: email.toLowerCase(),
      password: password,
      passwordConfirm: password,
      name: combinedName,
      phone,
      class: userClass || null,
      model: 'Free' as UserModel,
      role: 'User' as UserRole,
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 78)).toISOString().split('T')[0],
      totalPoints: 0,
      referralCode: newUserReferralCode,
      referredByCode: upperCaseReferredByCode, // Save the entered code, valid or not
      referralStats: {
        referred_free: 0,
        referred_chapterwise: 0,
        referred_full_length: 0,
        referred_combo: 0,
        referred_dpp: 0,
      },
      targetYear: null,
      avatar: null,
      emailVisibility: true,
      verified: false,
    };
    console.log(`[${actionName}] Attempting to create user in PocketBase with data:`, Omit(userDataForPocketBase, 'password', 'passwordConfirm'));

    // Use global pb instance for user creation, relying on public Create Rule for 'users' collection
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
    console.log(`[${actionName}] User created successfully in PocketBase: ${newUser.id}`);

  } catch (error) {
    console.error(`[${actionName}] User Creation Failed in PocketBase:`, error);
    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.';

    if (error instanceof ClientResponseError) {
        console.error(`[${actionName}] PocketBase ClientResponseError (User Creation) details (error.data):`, JSON.stringify(error.data, null, 2));
        genericMessage = error.data?.message || genericMessage;
        const pbFieldErrors = error.data?.data;
        if (pbFieldErrors && typeof pbFieldErrors === 'object') {
            specificDetails = Object.keys(pbFieldErrors).map(key => {
                const fieldError = pbFieldErrors[key];
                if (fieldError && fieldError.message) {
                    return `${key}: ${fieldError.message}`;
                }
                return null;
            }).filter(Boolean).join('; ');
        }
         if (error.status === 0) {
          genericMessage = "Network Error: Could not connect to the server. Please check your internet connection and the server status.";
        }
    } else if (error instanceof Error) {
        genericMessage = error.message || genericMessage;
    }

    let finalErrorMessage = genericMessage;
    if (specificDetails) {
      if (genericMessage !== 'Something went wrong while processing your request.' && genericMessage !== 'Failed to create record.') {
        finalErrorMessage = `${genericMessage}. Details: ${specificDetails}`;
      } else {
        finalErrorMessage = specificDetails;
      }
    }
     if (!finalErrorMessage || !finalErrorMessage.trim()) {
        finalErrorMessage = 'An unknown error occurred during signup.';
    }
    return { success: false, message: `Signup failed: ${finalErrorMessage}`, error: finalErrorMessage };
  }

  // Attempt to update referrer stats if a code was entered and a referrer is found
  // This part might fail if admin credentials are not set in .env, but user signup will still succeed.
  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[${actionName}] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    try {
      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal);
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);

        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };

        // Use pbGlobal; this will likely fail if rules don't allow current user to update another.
        // This is acceptable per user request to not block signup for admin auth issues.
        await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, pbGlobal);
        console.log(`[${actionName}] Attempted to update referral stats for referrer: ${referrerToUpdateStats.name} to`, newReferrerStats, " (This may fail if not admin and rules are restrictive)");
      } else {
        console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user.`);
      }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referral stats update process for ${upperCaseReferredByCode}. User signup itself was successful. This part requires permission to update other users. Error:`, statsError.message, statsError);
    }
  }

  return { success: true, message: 'Signup successful! Please log in.', userId: newUser.id };
}

export async function loginUserAction(data: { email: string, password_login: string }): Promise<{
  success: boolean;
  message: string;
  error?: string;
  userId?: string,
  userFullName?: string,
  userName?: string, // This will be the first name
  userModel?: UserModel | null,
  userRole?: UserRole | null,
  userClass?: UserClass | null,
  userEmail?: string,
  userPhone?: string | null,
  userTargetYear?: number | string | null, // Allow string from localStorage
  userReferralCode?: string | null, // User's own referral code
  userReferredByCode?: string | null, // Code they signed up with
  userReferralStats?: User['referralStats'] | null,
  userExpiryDate?: string | null,
  userAvatarUrl?: string | null,
  token?: string
}> {
  const actionName = "Login User Action";
  const validation = LoginSchema.safeParse({email: data.email, password: data.password_login});
  if (!validation.success) {
     const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, message: "Validation failed", error: errorMessages };
  }

  const { email, password } = validation.data;
  const normalizedEmail = email.toLowerCase();
  console.log(`[${actionName}] Attempting login for: ${normalizedEmail}`);

  try {
    const authData = await pbGlobal.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      console.warn(`[${actionName}] Login failed for ${normalizedEmail}: Invalid credentials (no authData or record).`);
      return { success: false, message: 'Login failed. Please check your credentials.', error: 'Invalid credentials' };
    }
    console.log(`[${actionName}] Login successful for ${normalizedEmail}. User ID: ${authData.record.id}`);

    const user = authData.record as unknown as User;
    const userFullName = user.name || 'User';
    const userName = userFullName.split(' ')[0] || 'User'; // Extract first name

    let avatarUrl = null;
    if (user.avatar) { // PocketBase stores just the filename in the avatar field
        avatarUrl = pbGlobal.getFileUrl(user, user.avatar as string);
    }

    return {
      success: true,
      message: 'Login successful!',
      token: authData.token,
      userId: user.id,
      userFullName: userFullName,
      userName: userName, // Return first name
      userModel: user.model || null,
      userRole: user.role || null,
      userClass: user.class || null,
      userEmail: user.email, // Already lowercased
      userPhone: user.phone || null,
      userTargetYear: user.targetYear?.toString() || null, // Ensure it's string or null
      userReferralCode: user.referralCode || null, // User's own code
      userReferredByCode: user.referredByCode || null, // Code they used
      userReferralStats: user.referralStats || null,
      userExpiryDate: user.expiry_date || null,
      userAvatarUrl: avatarUrl,
    };

  } catch (error) {
    console.error(`[${actionName}] Login Error for ${normalizedEmail}:`, error);
    let errorMessage = 'Login Failed: Invalid email or password.';
     if (error instanceof ClientResponseError) {
        console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data));
        if (error.status === 400) { // Typically "Failed to authenticate."
           errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        } else if (error.status === 0) {
          errorMessage = "Login Failed: Network Error. Could not connect to the server. Please check your internet connection and the server status.";
        } else {
           errorMessage = error.data?.message || `Login error (status ${error.status}). Please try again.`;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function updateUserProfileAction({
  userId,
  classToUpdate,
  targetYearToUpdate
}: {
  userId: string,
  classToUpdate?: UserClass | '', // Allow empty string for "Not Set" from client
  targetYearToUpdate?: string // Allow string for "Not Set" or year
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";
  console.log(`[${actionName}] Attempting to update profile for user ID: ${userId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);

  if (!userId) {
    const errorMsg = "User ID is required for profile update. (UPA_E001)";
    console.warn(`[${actionName}] ${errorMsg}`);
    return { success: false, message: errorMsg, error: errorMsg };
  }

  // This action will use pbGlobal. If the client is authenticated, pbGlobal
  // (when called from a server action invoked by an authenticated client)
  // should carry the user's auth context, allowing them to update their own record
  // if PocketBase users collection Update Rule is `@request.auth.id = id`.

  if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.id !== userId) {
    const authError = "Permission Denied: You can only update your own profile. (UPA_E_AUTH_MISMATCH_SERVER)";
    console.warn(`[${actionName}] Auth mismatch: Auth store valid: ${pbGlobal.authStore.isValid}, Auth store user ID: ${pbGlobal.authStore.model?.id}, Target user ID: ${userId}`);
    // This check might be too strict if pbGlobal doesn't perfectly reflect client auth in server action.
    // Relying more on PocketBase rules for the actual update attempt.
    // For now, let's proceed and let PocketBase deny if permissions are insufficient.
  }

  const dataForPocketBase: Partial<Pick<User, 'class' | 'targetYear'>> = {};

  if (classToUpdate !== undefined) {
    dataForPocketBase.class = classToUpdate === '' ? null : classToUpdate;
  }

  if (targetYearToUpdate !== undefined) {
    if (targetYearToUpdate === "-- Not Set --" || targetYearToUpdate === '') {
      dataForPocketBase.targetYear = null;
    } else {
      const year = parseInt(targetYearToUpdate, 10);
      dataForPocketBase.targetYear = !isNaN(year) ? year : null;
    }
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    console.log(`[${actionName}] No changes to save for user ${userId}.`);
    return { success: true, message: "No changes to save." };
  }

  console.log(`[${actionName}] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  try {
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
    console.log(`[${actionName}] Profile updated successfully for user ${userId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile. (UPA_E002_SERVER)";
     if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to update this profile. Ensure your PocketBase 'users' collection updateRule is correctly set (e.g., @request.auth.id = id). (UPA_E003_SERVER)";
        } else if (error.status === 404) {
           errorMessage = `User not found (ID: ${userId}). Could not update profile. (UPA_E004_SERVER)`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to update profile. (UPA_E005_SERVER)";
        }
     } else if (error instanceof Error) {
        errorMessage = error.message;
     }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const actionName = "Get Referrer Info Action";

  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    const noAuthMsg = "User not authenticated or user context not available to server action. (GRIA_E001_SERVER)";
    console.warn(`[${actionName}] ${noAuthMsg}`);
    return { referrerName: null, error: noAuthMsg };
  }
  const currentAuthUserId = pbGlobal.authStore.model.id;

  let currentUserRecord;
  try {
    currentUserRecord = await findUserById(currentAuthUserId, pbGlobal);
  } catch (e) {
     const fetchUserError = `Error fetching current user's record (ID: ${currentAuthUserId}): ${e.message}. (GRIA_E002_SERVER)`;
     console.error(`[${actionName}] ${fetchUserError}`);
     return { referrerName: null, error: fetchUserError };
  }

  if (!currentUserRecord || !currentUserRecord.referredByCode) {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserRecord.referredByCode}`);

  try {
    // Use pbGlobal for reading referrer data; assumes 'users' viewRule is permissive enough
    // (e.g., public or `@request.auth.id != ""`)
    const referrer = await findUserByReferralCode(currentUserRecord.referredByCode, pbGlobal);
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserRecord.referredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      const notFoundMsg = `Referrer with code ${currentUserRecord.referredByCode} not found, or name is missing. (GRIA_E003_SERVER)`;
      console.warn(`[${actionName}] ${notFoundMsg}`);
      return { referrerName: null, error: notFoundMsg };
    }
  } catch (error) {
    const fetchReferrerError = `Error fetching referrer by code ${currentUserRecord.referredByCode}: ${error.message}. (GRIA_E004_SERVER)`;
    console.error(`[${actionName}] ${fetchReferrerError}`);
    return { referrerName: null, error: fetchReferrerError };
  }
}


export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const actionName = "Update User Avatar Action";
   if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    const authErrorMessage = "User not authenticated. Please log in to update your avatar. (UAA_E001_SERVER)";
    console.warn(`[${actionName}] ${authErrorMessage}`);
    return { success: false, message: authErrorMessage, error: "Authentication required." };
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId} using current user's auth context (pbGlobal).`);

  try {
    // PocketBase 'users' collection 'updateRule' should be '@request.auth.id = id'
    // The pbGlobal instance, when called from a server action triggered by an authenticated client,
    // should carry that client's auth context.
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
    console.log(`[${actionName}] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar. (UAA_E002_SERVER)";
    if (error instanceof ClientResponseError) {
        errorMessage = error.data?.message || errorMessage;
         if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to update this avatar. Ensure your PocketBase 'users' collection updateRule is '@request.auth.id = id'. (UAA_E003_SERVER)";
        } else if (error.status === 404) {
           errorMessage = `User not found (ID: ${userId}). Could not update avatar. (UAA_E004_SERVER)`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to update avatar. (UAA_E005_SERVER)";
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
   const actionName = "Remove User Avatar Action";
   if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    const authErrorMessage = "User not authenticated. Please log in to remove your avatar. (RAA_E001_SERVER)";
    console.warn(`[${actionName}] ${authErrorMessage}`);
    return { success: false, message: authErrorMessage, error: "Authentication required." };
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId} using current user's auth context (pbGlobal).`);

  try {
    // PocketBase 'users' collection 'updateRule' should be '@request.auth.id = id'
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
    console.log(`[${actionName}] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar. (RAA_E002_SERVER)";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
        if (error.status === 403) {
           errorMessage = "Permission Denied: You may not have permission to remove this avatar. Ensure your PocketBase 'users' collection updateRule is '@request.auth.id = id'. (RAA_E003_SERVER)";
        } else if (error.status === 404) {
           errorMessage = `User not found (ID: ${userId}). Could not remove avatar. (RAA_E004_SERVER)`;
        } else if (error.status === 0) {
          errorMessage = "Network Error: Could not connect to PocketBase to remove avatar. (RAA_E005_SERVER)";
        }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}

export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  const actionName = "Add Question Action";
  console.log(`[${actionName}] Attempting to add question.`);
  console.log(`[${actionName}] Received form data keys:`, Array.from(formData.keys()));

  // Relying on client-side guards for admin access to the page,
  // and PocketBase 'question_bank' Create Rule being "" (public/open)
  // or "@request.auth.id != "" && @request.auth.role = "Admin""
  // If the rule is "@request.auth.id != "" && @request.auth.role = "Admin"",
  // then pbGlobal.authStore must be valid and represent an Admin user.

  // This check relies on pbGlobal.authStore being correctly populated in the server action context
  // when called by an authenticated client.
  // if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.role !== 'Admin') {
  //   const authError = "User is not authenticated as Admin. Cannot add question. (AQA_E001_SERVER_ROLE_CHECK)";
  //   console.warn(`[${actionName}] ${authError}. Auth store valid: ${pbGlobal.authStore.isValid}, Role: ${pbGlobal.authStore.model?.role}`);
  //   return { success: false, message: authError, error: "Permission Denied. Admin role required." };
  // }
  // Removed the above check to rely on PocketBase's Create Rule.
  // If Create Rule is "", this will succeed.
  // If Create Rule is "@request.auth.id != "" && @request.auth.role = "Admin"",
  // this will succeed if the client calling this action is an Admin.

  try {
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };

  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question. (AQA_E003_SERVER_CREATE_FAIL)";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data, null, 2));

      if (error.data?.data) {
        detailedFieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      }

      if (error.status === 403) {
        errorMessage = "Permission Denied: You do not have permission to add questions. Ensure your PocketBase 'question_bank' collection Create Rule is correctly set (e.g., to allow Admin role or be public) and you are logged in with appropriate privileges. (AQA_E004_SERVER_403)";
      } else if (detailedFieldErrors) {
        errorMessage = `Failed to create record due to validation errors. Details: ${detailedFieldErrors} (AQA_E005_SERVER_VALIDATION)`;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.status === 0) {
         errorMessage = "Network Error: Could not connect to PocketBase to add the question. Please check your internet connection and the server status. (AQA_E006_SERVER_NET_ERR)";
      } else {
        errorMessage = `Failed to create record. Please check inputs. (Status: ${error.status}) (AQA_E007_SERVER_OTHER_PB_ERR)`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, message: errorMessage, error: errorMessage };
  }
}


// export async function getAllUsersAction(): Promise<{
//   success: boolean;
//   users?: Partial<User>[]; // Return a simpler user object for display
//   message?: string;
//   error?: string;
// }> {
//   const actionName = "Get All Users Action";
//   console.log(`[${actionName}] Attempting to fetch all users.`);
//   // This action requires admin privileges because the 'users' collection List Rule is admin-only.
//   // Ensure POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are set in .env
//   const adminPb = await requirePocketBaseAdmin(); // Uses the new robust admin client loader

//   if (!adminPb) { // Should not happen if requirePocketBaseAdmin is used, as it throws
//     const authError = "Admin authentication required to fetch users. (GAUA_E001)";
//     console.warn(`[${actionName}] ${authError}`);
//     return { success: false, message: authError, error: "Admin auth missing" };
//   }

//   try {
//     const records = await adminPb.collection('users').getFullList({
//       sort: '-created', // Sort by creation date, newest first
//     });

//     const usersForDisplay = records.map(record => ({
//       id: record.id,
//       name: record.name,
//       email: record.email,
//       role: record.role as UserRole,
//       model: record.model as UserModel,
//       created: record.created ? format(new Date(record.created), "dd MMM yyyy") : 'N/A',
//       avatarUrl: record.avatar ? adminPb.getFileUrl(record, record.avatar) : null,
//     }));

//     console.log(`[${actionName}] Successfully fetched ${usersForDisplay.length} users.`);
//     return { success: true, users: usersForDisplay };
//   } catch (error) {
//     let errorMessage = "Failed to fetch users. (GAUA_E002)";
//     if (error instanceof ClientResponseError) {
//       errorMessage = error.data?.message || `PocketBase error while fetching users: ${error.status}. (GAUA_E003_PB_ERR)`;
//       console.error(`[${actionName}] PocketBase ClientResponseError:`, JSON.stringify(error.data));
//     } else if (error instanceof Error) {
//       errorMessage = error.message;
//     }
//     console.error(`[${actionName}] Error:`, error);
//     return { success: false, message: errorMessage, error: "Fetch failed" };
//   }
// }


export async function getLiveReferralStatsAction(): Promise<{
  success: boolean;
  stats?: User['referralStats'];
  message?: string;
  error?: string;
}> {
  const actionName = "Get Live Referral Stats Action";
  let adminPb;

  try {
    console.log(`[${actionName}] Attempting to get admin PB instance.`);
    adminPb = await requirePocketBaseAdmin(); // This will throw if admin auth fails
    console.log(`[${actionName}] Admin PB instance obtained.`);
  } catch (adminAuthError) {
    const errorMessage = adminAuthError instanceof Error ? adminAuthError.message : "Unknown error during admin authentication.";
    console.error(`[${actionName}] Failed to initialize admin client:`, errorMessage);
    // Log the detailed error and return a structured error object to the client
    console.log(`[${actionName}] Returning error from admin auth catch: ${JSON.stringify({ success: false, message: `Admin client initialization failed: ${errorMessage} (GLRSA_E001)`, error: `Admin client initialization failed: ${errorMessage} (GLRSA_E001)` })}`);
    return { success: false, message: `Admin client initialization failed: ${errorMessage} (GLRSA_E001)`, error: `Admin client initialization failed: ${errorMessage} (GLRSA_E001)` };
  }

  try {
    let targetUserReferralCode: string | null = null;

    // Get the referral code of the user calling this action (the one whose stats we want)
    // This relies on pbGlobal.authStore being populated correctly in the server action context
    if (pbGlobal.authStore.isValid && pbGlobal.authStore.model?.referralCode) {
        targetUserReferralCode = pbGlobal.authStore.model.referralCode as string;
    } else {
        const noClientUserMsg = "No authenticated client user found (or no referral code) to get referral code for live stats. (GLRSA_E002B_NO_CLIENT_USER)";
        console.warn(`[${actionName}] ${noClientUserMsg}`);
        console.log(`[${actionName}] Returning error from no client user: ${JSON.stringify({ success: false, stats: undefined, message: noClientUserMsg, error: "GLRSA_E002B_NO_CLIENT_USER" })}`);
        return { success: false, stats: undefined, message: noClientUserMsg, error: "GLRSA_E002B_NO_CLIENT_USER" };
    }

    console.log(`[${actionName}] Calculating stats for users referred by code: ${targetUserReferralCode} using admin client.`);
    const referredUsers = await adminPb.collection('users').getFullList({
      filter: `referredByCode = "${targetUserReferralCode}"`,
    });

    const liveStats: User['referralStats'] = {
      referred_free: 0,
      referred_chapterwise: 0,
      referred_full_length: 0,
      referred_combo: 0,
      referred_dpp: 0,
    };

    referredUsers.forEach(user => {
      switch (user.model as UserModel) {
        case 'Free':
          liveStats.referred_free = (liveStats.referred_free || 0) + 1;
          break;
        case 'Chapterwise':
          liveStats.referred_chapterwise = (liveStats.referred_chapterwise || 0) + 1;
          break;
        case 'Full_length':
          liveStats.referred_full_length = (liveStats.referred_full_length || 0) + 1;
          break;
        case 'Combo':
          liveStats.referred_combo = (liveStats.referred_combo || 0) + 1;
          break;
        case 'Dpp':
           liveStats.referred_dpp = (liveStats.referred_dpp || 0) + 1;
           break;
        default:
          // Potentially log an unknown model or ignore
          break;
      }
    });
    console.log(`[${actionName}] Successfully calculated live stats:`, JSON.stringify(liveStats));
    console.log(`[${actionName}] Returning success: ${JSON.stringify({ success: true, stats: liveStats, message: "Stats fetched successfully." })}`);
    return { success: true, stats: liveStats, message: "Stats fetched successfully." };

  } catch (error) {
    let clientErrorMessage = "Failed to calculate live referral stats. (GLRSA_E003_OUTER_CATCH)";
    let clientErrorCode = "GLRSA_E003_OUTER_CATCH";
    console.error(`[${actionName}] Error calculating live referral stats:`, error);

    if (error instanceof ClientResponseError) {
        clientErrorMessage = error.data?.message || `PocketBase error: ${error.status}. (GLRSA_E004_PB_ERROR)`;
        clientErrorCode = `GLRSA_E004_PB_${error.status}`;
        if (error.status === 403) {
            clientErrorMessage = "Permission Denied: You do not have permission to list all users to calculate live referral stats. This action may require admin privileges. (GLRSA_E005_PB_403)";
            clientErrorCode = "GLRSA_E005_PB_403";
        } else if (error.status === 0) {
          clientErrorMessage = "Network Error: Could not connect to PocketBase for live stats. (GLRSA_E007_PB_0)";
          clientErrorCode = "GLRSA_E007_PB_0";
        }
    } else if (error instanceof Error && error.message) {
        clientErrorMessage = error.message;
    }
    // Log the detailed error and return a structured error object to the client
    console.log(`[${actionName}] Returning error from outer catch: ${JSON.stringify({ success: false, stats: undefined, message: clientErrorMessage, error: clientErrorCode })}`);
    return { success: false, stats: undefined, message: clientErrorMessage, error: clientErrorCode };
  }
}


export async function getLessonsBySubjectAction(subject: string): Promise<{ success: boolean; lessons?: string[]; message?: string; error?: string; }> {
  const actionName = "Get Lessons By Subject Action";
  console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject}`);
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pbGlobal.baseUrl}`);

  if (!subject) {
    const errorMsg = "Subject is required to fetch lessons. (GLBSA_E002_NO_SUBJECT)";
    console.warn(`[${actionName}] ${errorMsg}`);
    return { success: false, message: errorMsg, error: "GLBSA_E002" };
  }

  try {
    // Uses global pb instance. Relies on PocketBase question_bank collection rules being public.
    const records = await pbGlobal.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName',
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));

    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch lessons for ${subject}. (GLBSA_E003_FETCH_FAIL_OUTER)`;
    let errorCode = `GLBSA_E003`;
    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      // Use the refined error message from the error object itself if available
      errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}': ${error.status}. (GLBSA_E004_PB_ERROR)`;
      errorCode = `GLBSA_E004_PB_${error.status}`;
      if (error.status === 404) {
        // This specific message is helpful if the collection itself is not found.
        errorMessage = `Collection 'question_bank' not found when fetching lessons for subject '${subject}'. Ensure collection name is correct and PocketBase URL in .env is the root URL (eg. https://your-domain.com). Current URL used by SDK: ${pbGlobal.baseUrl}. (GLBSA_E006_PB_404)`;
        errorCode = `GLBSA_E006_PB_404`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase to fetch lessons for subject '${subject}'. (GLBSA_E007_PB_0)`;
        errorCode = `GLBSA_E007_PB_0`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    } else if (error instanceof Error && error.message) {
      errorMessage = error.message;
    }

    console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: errorMessage, error: errorCode })}`);
    return {
      success: false,
      message: errorMessage, // Return the more specific error message to the client
      error: errorCode
    };
  }
}

type PocketBase = import('pocketbase').default; // Import type for PocketBase
