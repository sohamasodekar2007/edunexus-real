// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase'; // Used for client-side or specific unauthenticated/admin server calls
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo, DppAttemptPayload, QuestionAttemptDetail } from '@/types';
import { format } from 'date-fns';
import { getPocketBaseAdmin, requirePocketBaseAdmin } from '@/lib/pocketbaseAdmin';
import { cookies } from 'next/headers'; // Import cookies
import PocketBase from 'pocketbase'; // Import PocketBase class for new instance


// Helper function for error responses
function createErrorResponse(message: string, errorCode?: string, details?: any) {
  const response = { success: false, message, error: errorCode || 'Unknown Error', details };
  console.error(`[Server Action Error] Code: ${errorCode}, Message: ${message}, Details:`, details || 'N/A');
  return response;
}


export async function validateReferralCodeAction(code: string): Promise<{ success: boolean; message: string; referrerName?: string }> {
  const actionName = "Validate Referral Code Action";
  const upperCaseCode = code.trim().toUpperCase();

  if (!upperCaseCode || upperCaseCode.length < 3) {
    // No message for too short codes to prevent probing.
    return { success: false, message: "" };
  }
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal); // pbGlobal is fine for this read if rules allow
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      // Do not explicitly say "invalid code" to the user to prevent probing.
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" }; // No message on error.
  }
}

export async function signupUserAction(data: SignupFormData): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  const actionName = "Signup User Action";
  console.log(`[${actionName}] Attempting signup for email: ${data.email}`);
  const validation = SignupSchema.safeParse(data);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.warn(`[${actionName}] Validation failed: ${errorMessages}`);
    return createErrorResponse("Validation failed. Please check your inputs.", "SIGNUP_VALIDATION_ERROR", errorMessages);
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
      referredByCode: upperCaseReferredByCode,
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
    console.log(`[${actionName}] Attempting to create user in PocketBase with data (password omitted from log):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    // User creation can use pbGlobal if the 'users' collection createRule is public.
    newUser = await createUserInPocketBase(userDataForPocketBase, pbGlobal);
    console.log(`[${actionName}] User created successfully in PocketBase: ${newUser.id}`);

  } catch (error) {
    console.error(`[${actionName}] User Creation Failed in PocketBase:`, error);
    let specificDetails = '';
    let genericMessage = 'Something went wrong while processing your request.';

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError (User Creation) details:`, JSON.stringify(error.data, null, 2));
      genericMessage = error.data?.message || genericMessage;
      const pbFieldErrors = error.data?.data;
      if (pbFieldErrors && typeof pbFieldErrors === 'object') {
        specificDetails = Object.keys(pbFieldErrors).map(key => {
          const fieldError = pbFieldErrors[key];
          return fieldError && fieldError.message ? `${key}: ${fieldError.message}` : null;
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
      finalErrorMessage = genericMessage !== 'Something went wrong while processing your request.' && genericMessage !== 'Failed to create record.'
        ? `${genericMessage}. Details: ${specificDetails}`
        : specificDetails;
    }
    if (!finalErrorMessage || !finalErrorMessage.trim()) {
      finalErrorMessage = 'An unknown error occurred during signup.';
    }
    return createErrorResponse(`Signup failed: ${finalErrorMessage}`, "SIGNUP_PB_CREATE_ERROR", finalErrorMessage);
  }

  if (newUser && newUser.id && upperCaseReferredByCode) {
    console.log(`[${actionName}] New user ${newUser.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    try {
      const adminPb = await getPocketBaseAdmin(); // Attempt to get admin client for referrer update
      if (adminPb) {
        const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, adminPb);
        if (referrerToUpdateStats && referrerToUpdateStats.id) {
          console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);
          const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
          const newReferrerStats: User['referralStats'] = {
            ...currentStats,
            referred_free: (currentStats.referred_free || 0) + 1,
          };
          await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, adminPb);
          console.log(`[${actionName}] Successfully updated referral stats for referrer ${referrerToUpdateStats.name} to`, newReferrerStats);
        } else {
          console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user's 'referredByCode' field.`);
        }
      } else {
        console.warn(`[${actionName}] Admin client not available. Could not update referrer stats for ${upperCaseReferredByCode}. Signup for new user was successful.`);
      }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referral stats lookup or update process for ${upperCaseReferredByCode}. User signup itself was successful. Error:`, statsError.message, statsError);
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
  userName?: string,
  userModel?: UserModel | null,
  userRole?: UserRole | null,
  userClass?: UserClass | null,
  userEmail?: string,
  userPhone?: string | null,
  userTargetYear?: string | null,
  userReferralCode?: string | null,
  userReferredByCode?: string | null,
  userReferralStats?: User['referralStats'] | null,
  userExpiryDate?: string | null,
  userAvatarUrl?: string | null,
  token?: string
}> {
  const actionName = "Login User Action";
  const validation = LoginSchema.safeParse({ email: data.email, password: data.password_login });
  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return createErrorResponse("Validation failed", "LOGIN_VALIDATION_ERROR", errorMessages);
  }

  const { email, password } = validation.data;
  const normalizedEmail = email.toLowerCase();
  console.log(`[${actionName}] Attempting login for: ${normalizedEmail}`);

  try {
    const authData = await pbGlobal.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      console.warn(`[${actionName}] Login failed for ${normalizedEmail}: Invalid credentials (no authData or record).`);
      return createErrorResponse('Login failed. Please check your credentials.', "LOGIN_INVALID_CREDENTIALS", 'Invalid credentials');
    }
    console.log(`[${actionName}] Login successful for ${normalizedEmail}. User ID: ${authData.record.id}`);

    const user = authData.record as unknown as User;
    const userFullName = user.name || 'User';
    const userName = userFullName.split(' ')[0] || 'User';

    let avatarUrl = null;
    if (user.avatar) {
      avatarUrl = pbGlobal.getFileUrl(user, user.avatar as string);
    }

    return {
      success: true,
      message: 'Login successful!',
      token: authData.token,
      userId: user.id,
      userFullName: userFullName,
      userName: userName,
      userModel: user.model || null,
      userRole: user.role || null,
      userClass: user.class || null,
      userEmail: user.email,
      userPhone: user.phone || null,
      userTargetYear: user.targetYear?.toString() || null,
      userReferralCode: user.referralCode || null,
      userReferredByCode: user.referredByCode || null,
      userReferralStats: user.referralStats || null,
      userExpiryDate: user.expiry_date || null,
      userAvatarUrl: avatarUrl,
    };

  } catch (error) {
    console.error(`[${actionName}] Login Error for ${normalizedEmail}:`, error);
    let errorMessage = 'Login Failed: Invalid email or password.';
    let errorCode = "LOGIN_AUTH_FAILED";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data));
      if (error.status === 400) {
        errorMessage = 'Login Failed: Failed to authenticate. Please check your email and password.';
        errorCode = "LOGIN_PB_400_AUTH";
      } else if (error.status === 0) {
        errorMessage = "Login Failed: Network Error. Could not connect to the server. Please check your internet connection and the server status.";
        errorCode = "LOGIN_PB_0_NET_ERR";
      } else {
        errorMessage = error.data?.message || `Login error (status ${error.status}). Please try again.`;
        errorCode = `LOGIN_PB_${error.status}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function updateUserProfileAction({
  classToUpdate,
  targetYearToUpdate
}: {
  classToUpdate?: UserClass | '',
  targetYearToUpdate?: string
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  pb.authStore.loadFromCookie(authCookie?.value || '');

  try {
    await pb.collection('users').authRefresh(); // Verify and refresh auth if needed
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      console.warn(`[${actionName}] User not authenticated in action context.`);
      return createErrorResponse("User not authenticated. Please log in again.", "UPA_E001_NO_AUTH");
    }
  } catch (_) {
    console.warn(`[${actionName}] Auth refresh failed. User likely not authenticated.`);
    pb.authStore.clear();
    return createErrorResponse("User authentication is invalid. Please log in again.", "UPA_E001B_AUTH_REFRESH_FAIL");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Attempting to update profile for authenticated user ID: ${userId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);
  
  const dataForPocketBase: Partial<Pick<User, 'class' | 'targetYear'>> = {};
  if (classToUpdate !== undefined) {
    dataForPocketBase.class = classToUpdate === '' ? null : classToUpdate;
  }
  if (targetYearToUpdate !== undefined) {
    const parsedYear = parseInt(targetYearToUpdate, 10);
    dataForPocketBase.targetYear = (targetYearToUpdate === "-- Not Set --" || targetYearToUpdate === '' || isNaN(parsedYear)) ? null : parsedYear;
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    console.log(`[${actionName}] No changes to save for user ${userId}.`);
    return { success: true, message: "No changes to save." };
  }
  console.log(`[${actionName}] Data to send to PocketBase for user ${userId}:`, dataForPocketBase);

  try {
    // This uses the 'pb' instance that is authenticated as the current user.
    // PocketBase's 'users' collection Update Rule should be @request.auth.id = id
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pb);
    console.log(`[${actionName}] Profile updated successfully for user ${userId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${userId}:`, error);
    let errorMessage = "Failed to update profile.";
    let errorCode = "UPA_E002_UPDATE_FAIL";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UPA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied (403): You may not have permission to update this profile. PocketBase 'users' collection updateRule should be '@request.auth.id = id'. Server log: ${JSON.stringify(error.data)}`;
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not update profile.`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to update profile.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const actionName = "Get Referrer Info Action";

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  pb.authStore.loadFromCookie(authCookie?.value || '');

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return { referrerName: null, error: "User not authenticated to fetch referrer info. (GRICA_E001)" };
    }
  } catch (_) {
    pb.authStore.clear();
    return { referrerName: null, error: "User auth refresh failed when fetching referrer info. (GRICA_E001B)" };
  }

  const currentAuthUserId = pb.authStore.model.id;
  const currentUserReferredByCode = pb.authStore.model.referredByCode as string | undefined;

  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    // This read operation should be allowed by default PocketBase user view rules if any.
    // Or use adminPb if it needs elevated privilege to see other users.
    // For now, using the user's own auth context.
    const referrer = await findUserByReferralCode(currentUserReferredByCode, pb);
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserReferredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      console.warn(`[${actionName}] Referrer with code ${currentUserReferredByCode} not found, or name is missing.`);
      return { referrerName: null, error: `Referrer with code ${currentUserReferredByCode} not found, or name is missing. (GRICA_E002)`};
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${actionName}] Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`);
    return { referrerName: null, error: `Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}. (GRICA_E003)`};
  }
}

export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Update User Avatar Action";

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  pb.authStore.loadFromCookie(authCookie?.value || '');

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_E001_NO_AUTH_SERVER");
    }
  } catch (_) {
    pb.authStore.clear();
    return createErrorResponse("User auth refresh failed. Please log in again to update avatar.", "UAA_E001B_AUTH_REFRESH_FAIL");
  }
  
  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}. formData keys: ${Array.from(formData.keys()).join(', ')}`);

  try {
    // PocketBase 'users' collection Update Rule should be @request.auth.id = id
    const updatedRecord = await updateUserInPocketBase(userId, formData, pb);
    console.log(`[${actionName}] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar.";
    let errorCode = "UAA_E002_UPDATE_FAIL";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UAA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied (403): You may not have permission to update this avatar. PocketBase 'users' collection updateRule should be '@request.auth.id = id'. Server Log: ${JSON.stringify(error.data)}`;
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not update avatar.`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to update avatar.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Remove User Avatar Action";

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  pb.authStore.loadFromCookie(authCookie?.value || '');

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_E001_NO_AUTH_SERVER");
    }
  } catch (_) {
    pb.authStore.clear();
    return createErrorResponse("User auth refresh failed. Please log in again to remove avatar.", "RAA_E001B_AUTH_REFRESH_FAIL");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId}.`);

  try {
    // PocketBase 'users' collection Update Rule should be @request.auth.id = id
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pb);
    console.log(`[${actionName}] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar.";
    let errorCode = "RAA_E002_UPDATE_FAIL";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `RAA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied (403): You may not have permission to remove this avatar. PocketBase 'users' collection updateRule should be '@request.auth.id = id'. Server Log: ${JSON.stringify(error.data)}`;
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not remove avatar.`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to remove avatar.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function addQuestionAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; questionId?: string }> {
  const actionName = "Add Question Action";
  console.log(`[${actionName}] Attempting to add question. FormData keys:`, Array.from(formData.keys()));

  // This action now relies on the calling user being authenticated and having the 'Admin' role,
  // as enforced by PocketBase's 'question_bank' collection "Create Rule": @request.auth.id != "" && @request.auth.role = "Admin"
  // The pbGlobal instance will carry the client's auth token if this action is called from an authenticated client.

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  pb.authStore.loadFromCookie(authCookie?.value || '');

  try {
    await pb.collection('users').authRefresh(); // Ensure authStore is up-to-date
    if (!pb.authStore.isValid) {
      return createErrorResponse("User is not authenticated. Cannot add question. (AQA_E001_NO_AUTH)", "AQA_E001_NO_AUTH", "The server action context is not authenticated.");
    }
    if (pb.authStore.model?.role !== 'Admin') {
      return createErrorResponse("User is not authorized (not an Admin). Cannot add question. (AQA_E002_NOT_ADMIN)", "AQA_E002_NOT_ADMIN", `User role is: ${pb.authStore.model?.role}`);
    }
  } catch (_) {
    pb.authStore.clear();
    return createErrorResponse("User auth refresh failed. Cannot add question. (AQA_E001B_AUTH_REFRESH)", "AQA_E001B_AUTH_REFRESH", "Auth refresh failed, user likely not logged in.");
  }
  
  console.log(`[${actionName}] User is authenticated as Admin (ID: ${pb.authStore.model.id}). Proceeding to create question.`);

  try {
    const newQuestionRecord = await pb.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };
  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question.";
    let errorCode = "AQA_E003_CREATE_FAIL";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data, null, 2));
      if (error.data?.data) {
        detailedFieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      }

      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): The current user (Role: ${pb.authStore.model?.role}) does not have permission to add questions. Ensure PocketBase 'question_bank' collection Create Rule is correctly set (e.g., '@request.auth.id != "" && @request.auth.role = "Admin"').`;
      } else if (error.status === 401) { 
         errorMessage = `Authentication Required by PocketBase (401): User is not authenticated or token is invalid. Please log in.`;
      } else if (detailedFieldErrors) {
        errorMessage = `Failed to create record due to validation errors. Details: ${detailedFieldErrors}`;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to add the question.";
      } else {
        errorMessage = `Failed to create record. Please check inputs. (Status: ${error.status})`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, detailedFieldErrors || errorMessage);
  }
}

export async function getLessonsBySubjectAction(subject: string): Promise<{ success: boolean; lessons?: string[]; message?: string; error?: string; }> {
  const actionName = "Get Lessons By Subject Action";
  console.log(`[${actionName}] Attempting to fetch lessons for subject: ${subject}`);

  // This action relies on PocketBase 'question_bank' collection View Rule being public or allowing authenticated users.
  // For example, rule: "@request.auth.id != "" " (any authenticated user) or "" (public).
  // We'll use a new PB instance and load cookie to act as the calling user.
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  pb.authStore.loadFromCookie(authCookie?.value || '');
  
  try {
    await pb.collection('users').authRefresh(); // Ensure authStore is up-to-date
    if (!pb.authStore.isValid) {
      // If view rule is public, this check might be too strict.
      // However, if rule is @request.auth.id != "", then this check is appropriate.
      // Given the original problem statement, the user wants ANY authenticated user to see lessons.
      console.warn(`[${actionName}] User not authenticated. Proceeding with potentially unauthenticated request to PocketBase if rules allow.`);
      // If rules are public, PocketBase will allow. If rules require auth, PocketBase will deny.
    }
  } catch (_) {
      pb.authStore.clear();
      console.warn(`[${actionName}] Auth refresh failed. Proceeding with potentially unauthenticated request to PocketBase if rules allow.`);
  }


  if (!subject) {
    return createErrorResponse("Subject is required to fetch lessons.", "GLBSA_E002_NO_SUBJECT");
  }
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}`);

  try {
    const records = await pb.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', 
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));

    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch lessons for ${subject}.`;
    let errorCode = `GLBSA_E003_FETCH_FAIL`;
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}': ${error.status}.`;
      errorCode = `GLBSA_E004_PB_${error.status}`;
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found (or no records match) when fetching lessons for subject '${subject}'. Ensure collection name is correct and PocketBase URL in .env is the root URL. Current URL used by SDK: ${pb.baseUrl}. Filter: subject = "${subject}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied (${error.status}) by PocketBase: You may not have permission to view lessons. Please ensure you are logged in and your PocketBase 'question_bank' View/List Rule allows access (e.g., "@request.auth.id != """).`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase to fetch lessons for subject '${subject}'.`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}


export async function getQuestionsByLessonAction(subject: string, lessonName: string): Promise<{ success: boolean; questions?: QuestionDisplayInfo[]; message?: string; error?: string; }> {
  const actionName = "Get Questions By Lesson Action";
  console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName}`);
  
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  pb.authStore.loadFromCookie(authCookie?.value || '');

  try {
    await pb.collection('users').authRefresh();
    if (!pb.authStore.isValid) {
      // This action requires authenticated user as per view rule @request.auth.id != "" for question_bank
      console.warn(`[${actionName}] User not authenticated. PocketBase will likely deny access based on rules.`);
      // Return error here if we want to be strict, or let PocketBase handle it.
      // For now, let PocketBase handle it to see its specific error.
    }
  } catch (_) {
    pb.authStore.clear();
    console.warn(`[${actionName}] Auth refresh failed. PocketBase will likely deny access based on rules.`);
  }

  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pb.baseUrl}`);


  if (!subject || !lessonName) {
    return createErrorResponse("Subject and Lesson Name are required.", "GQBLA_E001_MISSING_PARAMS");
  }
  
  try {
    const records = await pb.collection('question_bank').getFullList({
      filter: `subject = "${subject}" && lessonName = "${lessonName}"`,
    });

    const questions: QuestionDisplayInfo[] = records.map(record => {
      let pyqInfo: PYQInfo | undefined = undefined;
      if (record.isPYQ) {
        pyqInfo = {
          examName: record.pyqExamName || undefined,
          year: record.pyqYear?.toString() || undefined,
          date: record.pyqDate ? format(new Date(record.pyqDate), "dd MMM yyyy") : undefined,
          shift: record.pyqShift || undefined,
        };
      }

      return {
        id: record.id,
        collectionId: record.collectionId,
        subject: record.subject,
        lessonName: record.lessonName,
        lessonTopic: record.lessonTopic || undefined,
        difficulty: record.difficulty,
        tags: record.tags || undefined,
        isPYQ: record.isPYQ,
        pyqInfo,
        questionType: record.questionType,
        questionText: record.questionText || undefined,
        questionImage: record.questionImage ? pb.getFileUrl(record, record.questionImage) : undefined,
        optionsFormat: record.optionsFormat || undefined,
        optionAText: record.optionAText || undefined,
        optionAImage: record.optionAImage ? pb.getFileUrl(record, record.optionAImage) : undefined,
        optionBText: record.optionBText || undefined,
        optionBImage: record.optionBImage ? pb.getFileUrl(record, record.optionBImage) : undefined,
        optionCText: record.optionCText || undefined,
        optionCImage: record.optionCImage ? pb.getFileUrl(record, record.optionCImage) : undefined,
        optionDText: record.optionDText || undefined,
        optionDImage: record.optionDImage ? pb.getFileUrl(record, record.optionDImage) : undefined,
        correctOption: record.correctOption,
        explanationText: record.explanationText || undefined,
        explanationImage: record.explanationImage ? pb.getFileUrl(record, record.explanationImage) : undefined,
      };
    });

    console.log(`[${actionName}] Successfully fetched ${questions.length} questions for ${subject} - ${lessonName}`);
    return { success: true, questions, message: "Questions fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch questions for ${subject} - ${lessonName}.`;
    let errorCode = "GQBLA_E002_FETCH_FAIL";
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching questions:`, error);

    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || `PocketBase error: ${error.status}.`;
      errorCode = `GQBLA_E003_PB_${error.status}`;
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found or no records match. Ensure collection name is correct and PocketBase URL in .env is the root URL. Current URL used: ${pb.baseUrl}. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied (${error.status}) by PocketBase: You may not have permission to view questions. Please ensure you are logged in and your PocketBase 'question_bank' View Rule allows access (e.g., "@request.auth.id != """).`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to fetch questions.";
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}


export async function saveDppAttemptAction(payload: DppAttemptPayload): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
  const actionName = "Save DPP Attempt Action";
  console.log(`[${actionName}] Received payload:`, JSON.stringify(payload, null, 2));

  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth'); // PocketBase's default cookie name is 'pb_auth'
  
  pb.authStore.loadFromCookie(authCookie?.value || '');
  console.log(`[${actionName}] pb.authStore.isValid after loading from cookie: ${pb.authStore.isValid}`);
  console.log(`[${actionName}] pb.authStore.token after loading from cookie: ${pb.authStore.token ? 'Exists' : 'Missing'}`);
  console.log(`[${actionName}] pb.authStore.model ID after loading from cookie: ${pb.authStore.model?.id || 'N/A'}`);


  try {
    // Attempt to refresh to ensure the token is valid and to get the latest user model
    // This also serves as an auth check.
    await pb.collection('users').authRefresh();
    console.log(`[${actionName}] Auth refresh successful. User ID: ${pb.authStore.model?.id}`);
  } catch (authError) {
    pb.authStore.clear(); // Clear potentially invalid store
    console.error(`[${actionName}] Auth refresh failed. User is likely not authenticated or token expired. Error:`, authError);
    if (authError instanceof ClientResponseError) {
      console.error(`[${actionName}] Auth refresh ClientResponseError details:`, JSON.stringify(authError.data));
    }
    return createErrorResponse(
        "User authentication failed or token expired. Please log in again to save DPP attempt. (SDPPA_E001_AUTH_REFRESH_FAIL)",
        "SDPPA_E001_AUTH_REFRESH_FAIL",
        authError instanceof Error ? authError.message : String(authError)
    );
  }

  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
      console.error(`[${actionName}] User is not properly authenticated after authRefresh. This should not happen if authRefresh succeeded.`);
      return createErrorResponse(
          "User authentication context is invalid after attempting refresh. Cannot save DPP attempt. (SDPPA_E001B_INVALID_CONTEXT_POST_REFRESH)",
          "SDPPA_E001B_INVALID_CONTEXT_POST_REFRESH"
      );
  }

  const userId = pb.authStore.model.id;

  const dataToSaveOrUpdate = {
    userId: userId, 
    subject: payload.subject,
    lessonName: payload.lessonName,
    attemptDate: new Date().toISOString(),
    questionsAttempted: payload.questionsAttempted,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
  };
  console.log(`[${actionName}] Data prepared for save/update for user ${userId}:`, JSON.stringify(dataToSaveOrUpdate, null, 2));

  try {
    let existingAttempt = null;
    const filter = `userId = "${userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
    console.log(`[${actionName}] Checking for existing attempt with filter: ${filter}`);
    try {
      existingAttempt = await pb.collection('dpp_attempts').getFirstListItem(filter);
      console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}). Will update.`);
    } catch (findError) {
      if (findError instanceof ClientResponseError && findError.status === 404) {
        console.log(`[${actionName}] No existing attempt found. Will create a new one.`);
        existingAttempt = null;
      } else {
        console.error(`[${actionName}] Error when checking for existing attempt:`, findError);
        if (findError instanceof ClientResponseError) console.error(`[${actionName}] Find Error Details:`, JSON.stringify(findError.data))
        throw findError; 
      }
    }

    if (existingAttempt) {
      console.log(`[${actionName}] Attempting to update existing attempt ID: ${existingAttempt.id}`);
      // PocketBase rule for update: @request.auth.id == userId (user can update their own)
      const updatedRecord = await pb.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
      return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
    } else {
      console.log(`[${actionName}] Attempting to create new DPP attempt.`);
      // PocketBase rule for create: @request.auth.id != "" (user can create, server ensures userId is set)
      const newRecord = await pb.collection('dpp_attempts').create(dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
      return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
    }

  } catch (error) {
    console.error(`[${actionName}] Error saving/updating DPP attempt for user ${userId}:`, error);
    let errorMessage = "Failed to save DPP attempt.";
    let errorCode = "SDPPA_E002_SAVE_FAIL";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] Save/Update Error Details:`, JSON.stringify(error.data));
      errorMessage = error.data?.message || errorMessage;
      errorCode = `SDPPA_PB_${error.status}`;
      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): You may not have permission to save/update this DPP attempt. Check PocketBase rules for 'dpp_attempts' collection. User: ${userId}, Subject: ${payload.subject}, Lesson: ${payload.lessonName}. Error data: ${JSON.stringify(error.data)}`;
      } else if (error.status === 401) { 
        errorMessage = `Authentication Required by PocketBase (401) to save DPP attempt. Please ensure you are logged in.`;
      } else if (error.status === 0) { 
         errorMessage = "Network Error: Could not connect to PocketBase to save DPP attempt.";
      } else if (error.data?.data){ 
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage = `Validation errors from server: ${fieldErrors}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, (error instanceof ClientResponseError ? JSON.stringify(error.data) : String(error)));
  }
}

export async function getLiveReferralStatsAction(): Promise<{ success: boolean; stats?: User['referralStats']; message?: string; error?: string }> {
  const actionName = "Get Live Referral Stats Action";
  let adminPb: PocketBase | null = null;

  try {
    adminPb = await requirePocketBaseAdmin(); // This will throw if admin auth fails
  } catch (adminAuthError) {
    const errMessage = adminAuthError instanceof Error ? adminAuthError.message : "Admin client initialization failed for an unknown reason.";
    console.error(`[${actionName}] Admin authentication failed:`, errMessage);
    // Log the full error object for deeper inspection if it's complex
    if (!(adminAuthError instanceof Error && adminAuthError.message.startsWith("Admin client initialization"))) {
        console.error(`[${actionName}] Full adminAuthError object:`, JSON.stringify(adminAuthError, null, 2));
    }
    return { 
        success: false, 
        message: "Admin client initialization or authentication failed. Check server logs for details. (GLRSA_E001)", 
        error: "Admin auth missing" 
    };
  }

  console.log(`[${actionName}] Admin client authenticated. Fetching current user's referral code.`);

  // Get the currently logged-in user's referral code using their own auth context
  const userPb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  const cookieStore = cookies();
  const authCookie = cookieStore.get('pb_auth');
  userPb.authStore.loadFromCookie(authCookie?.value || '');
  
  let currentUserReferralCode: string | null = null;
  try {
    await userPb.collection('users').authRefresh();
    if (userPb.authStore.isValid && userPb.authStore.model) {
      currentUserReferralCode = userPb.authStore.model.referralCode as string | null;
    } else {
      console.warn(`[${actionName}] Could not get current user's referral code: user not authenticated or model missing.`);
      return { success: false, message: "Could not determine current user's referral code. (GLRSA_E002)", error: "Current user auth issue" };
    }
  } catch (userAuthError) {
    userPb.authStore.clear();
    console.error(`[${actionName}] Error refreshing current user auth to get referral code:`, userAuthError);
    return { success: false, message: "Failed to authenticate current user to get referral code. (GLRSA_E002B)", error: "Current user auth refresh issue" };
  }

  if (!currentUserReferralCode) {
    console.log(`[${actionName}] Current user does not have a referral code.`);
    // Return empty/default stats if the user has no referral code
    return { 
        success: true, 
        stats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 } 
    };
  }

  console.log(`[${actionName}] Current user's referral code: ${currentUserReferralCode}. Fetching referred users with admin client.`);

  try {
    const referredUsers = await adminPb.collection('users').getFullList({
      filter: `referredByCode = "${currentUserReferralCode}"`,
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
        case 'Free': liveStats.referred_free = (liveStats.referred_free || 0) + 1; break;
        case 'Chapterwise': liveStats.referred_chapterwise = (liveStats.referred_chapterwise || 0) + 1; break;
        case 'Full_length': liveStats.referred_full_length = (liveStats.referred_full_length || 0) + 1; break;
        case 'Combo': liveStats.referred_combo = (liveStats.referred_combo || 0) + 1; break;
        case 'Dpp': liveStats.referred_dpp = (liveStats.referred_dpp || 0) + 1; break;
        // 'Teacher' model and others are not counted in these specific stats
      }
    });

    console.log(`[${actionName}] Successfully calculated live referral stats:`, liveStats);
    return { success: true, stats: liveStats };

  } catch (error) {
    const detailedErrorMessage = error instanceof ClientResponseError ? JSON.stringify(error.data) : String(error);
    console.error(`[${actionName}] Error fetching referred users or calculating stats: ${detailedErrorMessage}`, error);
    return { 
        success: false, 
        message: `Failed to calculate live referral stats. ${error instanceof ClientResponseError ? error.data?.message : error.message} (GLRSA_E003)`, 
        error: detailedErrorMessage 
    };
  }
}
