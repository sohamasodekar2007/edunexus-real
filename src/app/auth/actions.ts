// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import PocketBase from 'pocketbase'; // Import PocketBase class
import { cookies } from 'next/headers'; // Import cookies
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo, DppAttemptPayload, QuestionAttemptDetail } from '@/types';
import { format } from 'date-fns';


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
    return { success: false, message: "" };
  }
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      return { success: false, message: "" };
    }
  } catch (error) {
    console.error(`[${actionName}] Error validating referral code:`, error);
    return { success: false, message: "" };
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
  let newUserPocketBase;

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
    console.log(`[${actionName}] Attempting to create user in PocketBase with data (password omitted):`, { ...userDataForPocketBase, password: '***', passwordConfirm: '***' });
    
    // Creating user does not require admin if PocketBase createRule for 'users' is public
    newUserPocketBase = await createUserInPocketBase(userDataForPocketBase, pbGlobal); 
    console.log(`[${actionName}] User created successfully in PocketBase: ${newUserPocketBase.id}`);

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

  // For updating referrer stats, we might still need admin if rules are strict
  if (newUserPocketBase && newUserPocketBase.id && upperCaseReferredByCode) {
    console.log(`[${actionName}] New user ${newUserPocketBase.id} signed up with referral code: ${upperCaseReferredByCode}. Attempting to update referrer stats.`);
    try {
        const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
        const authCookie = cookies().get('pb_auth'); // This action itself is unauthenticated here.
                                                    // To update *another* user (referrer), we'd need admin or specific rules.
                                                    // For now, this part might fail if admin creds aren't available
                                                    // and PocketBase rules for updating other users are restrictive.
        
        // This part will likely fail without admin or specific rules
        // We will try with pbGlobal, if rules allow updating other user's stats (unlikely and not secure)
        const referrer = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal); 
        if (referrer) {
            console.log(`[${actionName}] Found referrer ${referrer.id}. Current stats:`, referrer.referralStats);
            const currentStats = referrer.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
            const newStats = {
                ...currentStats,
                referred_free: (currentStats.referred_free || 0) + 1,
            };
            // Attempting to update referrer stats. This needs appropriate PB rules or admin rights.
            // Using pbGlobal here means it's an unauthenticated request trying to update referrer.
            // This will only work if users collection has very permissive update rules for referralStats.
            await updateUserReferralStats(referrer.id, newStats, pbGlobal); 
            console.log(`[${actionName}] Attempted referrer stats update for ${referrer.id}. Stats:`, newStats);
        } else {
             console.warn(`[${actionName}] Referrer with code ${upperCaseReferredByCode} not found. No stats updated.`);
        }
    } catch (statsError) {
      console.warn(`[${actionName}] Error during referrer stats update for ${upperCaseReferredByCode}. This does not block signup. Error:`, statsError.message, statsError);
    }
  }
  return { success: true, message: 'Signup successful! Please log in.', userId: newUserPocketBase.id };
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
  token?: string,
  userRecordFromPb?: any, // Return the raw PB record for the client to use with pb.authStore.save
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
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL); // Create a new instance for this action

  try {
    const authData = await pb.collection('users').authWithPassword(normalizedEmail, password);

    if (!authData || !authData.record) {
      console.warn(`[${actionName}] Login failed for ${normalizedEmail}: Invalid credentials (no authData or record).`);
      return createErrorResponse('Login failed. Please check your credentials.', "LOGIN_INVALID_CREDENTIALS", 'Invalid credentials');
    }
    console.log(`[${actionName}] Login successful for ${normalizedEmail}. User ID: ${authData.record.id}`);

    const user = authData.record as unknown as User;
    const userFullName = user.name || 'User';
    const userName = userFullName.split(' ')[0] || 'User';
    const avatarFilename = user.avatar as string | undefined;
    const avatarUrl = avatarFilename ? pb.getFileUrl(user, avatarFilename) : null;
    const userReferredByCode = user.referredByCode || null; 

    return {
      success: true,
      message: 'Login successful!',
      token: authData.token,
      userRecordFromPb: authData.record, // Send the raw record for client-side pb.authStore.save
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
      userReferredByCode: userReferredByCode,
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

async function getAuthenticatedPbInstance(): Promise<PocketBase | null> {
    const actionName = "getAuthenticatedPbInstance";
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    const cookieStore = cookies();
    const authCookie = cookieStore.get('pb_auth');

    if (!authCookie?.value) {
        console.log(`[${actionName}] No auth cookie found.`);
        return null;
    }

    pb.authStore.loadFromCookie(authCookie.value);
    console.log(`[${actionName}] Auth cookie loaded. Validity before refresh: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);

    try {
        await pb.collection('users').authRefresh();
        console.log(`[${actionName}] Auth refresh successful. Validity after refresh: ${pb.authStore.isValid}, Model ID: ${pb.authStore.model?.id}`);
        if (!pb.authStore.isValid || !pb.authStore.model?.id) {
            console.warn(`[${actionName}] Session not valid after authRefresh.`);
            return null;
        }
        return pb;
    } catch (refreshError) {
        pb.authStore.clear();
        console.error(`[${actionName}] Auth refresh failed:`, (refreshError as Error).message);
        if (refreshError instanceof ClientResponseError) {
            console.error(`[${actionName}] PocketBase ClientResponseError during authRefresh:`, JSON.stringify(refreshError.data));
        }
        return null;
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
  
  const pb = await getAuthenticatedPbInstance();
  if (!pb) {
    return createErrorResponse("User not authenticated. Please log in again.", "UPA_NO_AUTH_SERVER");
  }
  
  const authenticatedUserId = pb.authStore.model.id;
  console.log(`[${actionName}] Attempting to update profile for authenticated user ID: ${authenticatedUserId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);
  
  const dataForPocketBase: Partial<Pick<User, 'class' | 'targetYear'>> = {};
  if (classToUpdate !== undefined) {
    dataForPocketBase.class = classToUpdate === '' ? null : classToUpdate;
  }
  if (targetYearToUpdate !== undefined) {
    const parsedYear = parseInt(targetYearToUpdate, 10);
    dataForPocketBase.targetYear = (targetYearToUpdate === "-- Not Set --" || targetYearToUpdate === '' || isNaN(parsedYear)) ? null : parsedYear;
  }

  if (Object.keys(dataForPocketBase).length === 0) {
    console.log(`[${actionName}] No changes to save for user ${authenticatedUserId}.`);
    return { success: true, message: "No changes to save." };
  }
  console.log(`[${actionName}] Data to send to PocketBase for user ${authenticatedUserId}:`, dataForPocketBase);

  try {
    const updatedUserRecord = await updateUserInPocketBase(authenticatedUserId, dataForPocketBase, pb); 
    console.log(`[${actionName}] Profile updated successfully for user ${authenticatedUserId}.`);
    return { success: true, message: "Profile updated successfully!", updatedUser: updatedUserRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update profile for user ${authenticatedUserId}:`, error);
    let errorMessage = "Failed to update profile.";
    let errorCode = "UPA_E002_UPDATE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UPA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403). Ensure 'users' collection Update Rule is '@request.auth.id = id'. Server log: ${JSON.stringify(error.data)}`;
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${authenticatedUserId}). Could not update profile.`;
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

  const pb = await getAuthenticatedPbInstance();
  if (!pb) {
    return { referrerName: null, error: "User not authenticated to fetch referrer info. (GRICA_NO_AUTH_SERVER)" };
  }

  const currentAuthUserId = pb.authStore.model.id;
  const currentUserRecord = await findUserById(currentAuthUserId, pb); 
  const currentUserReferredByCode = currentUserRecord?.referredByCode;


  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    const referrer = await findUserByReferralCode(currentUserReferredByCode, pb); 
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserReferredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      console.warn(`[${actionName}] Referrer with code ${currentUserReferredByCode} not found, or name is missing.`);
      return { referrerName: null, error: `Referrer with code ${currentUserReferredByCode} not found, or name is missing. (GRICA_E002_SERVER)`};
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${actionName}] Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`);
    return { referrerName: null, error: `Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}. (GRICA_E003_SERVER)`};
  }
}

export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Update User Avatar Action";
  
  const pb = await getAuthenticatedPbInstance();
  if (!pb) {
     return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_NO_AUTH_SERVER");
  }
  
  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}. formData keys: ${Array.from(formData.keys()).join(', ')}`);

  try {
    const updatedRecord = await updateUserInPocketBase(userId, formData, pb); 
    console.log(`[${actionName}] Avatar updated successfully for user ${userId}. New avatar filename: ${updatedRecord.avatar}`);
    return { success: true, message: "Avatar updated successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to update avatar for user ${userId}:`, error);
    let errorMessage = "Failed to update avatar.";
    let errorCode = "UAA_E002_UPDATE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `UAA_PB_${error.status}`;
      if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403) for avatar update. Ensure 'users' collection Update Rule is '@request.auth.id = id'. Details: ${JSON.stringify(error.data)}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Remove User Avatar Action";

  const pb = await getAuthenticatedPbInstance();
  if (!pb) {
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_NO_AUTH_SERVER");
  }

  const userId = pb.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId}.`);

  try {
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pb); 
    console.log(`[${actionName}] Avatar removed successfully for user ${userId}.`);
    return { success: true, message: "Avatar removed successfully!", updatedUserRecord: updatedRecord };
  } catch (error) {
    console.error(`[${actionName}] Failed to remove avatar for user ${userId}:`, error);
    let errorMessage = "Failed to remove avatar.";
    let errorCode = "RAA_E002_UPDATE_FAIL_SERVER";
     if (error instanceof ClientResponseError) {
      errorMessage = error.data?.message || errorMessage;
      errorCode = `RAA_PB_${error.status}`;
       if (error.status === 403) {
        errorMessage = `Permission Denied by PocketBase (403) for avatar removal. Ensure 'users' collection Update Rule is '@request.auth.id = id'. Details: ${JSON.stringify(error.data)}`;
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
  
  const pb = await getAuthenticatedPbInstance(); // This will use the authenticated user's context
  if (!pb) {
      return createErrorResponse("User not authenticated. Please log in to add questions.", "AQA_NO_AUTH_SERVER_ACTION");
  }
  
  // Server-side check for Admin role based on the authenticated user's record
  if (pb.authStore.model?.role !== 'Admin') {
      const authRole = pb.authStore.model?.role || 'Unknown/Not Authenticated';
      const msg = `Access Denied: You must have an Admin role to add questions. Your current role: ${authRole}.`;
      console.error(`[${actionName}] ${msg}`);
      return createErrorResponse(msg, "AQA_NOT_ADMIN_SERVER_ROLE_CHECK", msg);
  }

  console.log(`[${actionName}] User confirmed as Admin (${pb.authStore.model.id}). Proceeding to create question.`);

  try {
    // The 'pb' instance here is authenticated as the user calling the action.
    // PocketBase will enforce the collection's Create Rule (e.g., @request.auth.role = "Admin")
    const newQuestionRecord = await pb.collection('question_bank').create(formData);
    console.log(`[${actionName}] Question added successfully to PocketBase:`, newQuestionRecord.id);
    return { success: true, message: "Question added successfully!", questionId: newQuestionRecord.id };
  } catch (error) {
    console.error(`[${actionName}] Error adding question to PocketBase:`, error);
    let errorMessage = "Failed to add question.";
    let errorCode = "AQA_E003_CREATE_FAIL_SERVER";
    let detailedFieldErrors = "";

    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] PocketBase ClientResponseError details:`, JSON.stringify(error.data, null, 2));
      detailedFieldErrors = error.data?.data ? JSON.stringify(error.data.data) : "";

      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): Your Admin account may not have permission to add questions, or the data is invalid. Check PocketBase 'question_bank' Create Rule. Details: ${detailedFieldErrors || error.data?.message}`;
      } else if (error.status === 401) { 
         errorMessage = `Authentication Required by PocketBase (401) for creating question. This shouldn't happen if authRefresh succeeded.`;
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

  const pb = await getAuthenticatedPbInstance();
  if (!pb) {
    return createErrorResponse(
        "User not authenticated. Please log in to view lessons. (GLBSA_NO_AUTH_SERVER)",
        "GLBSA_NO_AUTH_SERVER",
        "Failed to get authenticated PocketBase instance."
    );
  }
  
  console.log(`[${actionName}] User authenticated for fetching lessons. User ID: ${pb.authStore.model.id}`);
  
  try {
    console.log(`[${actionName}] Proceeding to fetch lessons for subject: ${subject} using user ${pb.authStore.model.id}.`);
    const records = await pb.collection('question_bank').getFullList({
      filter: `subject = "${subject}"`,
      fields: 'lessonName', 
    });

    const uniqueLessonNames = Array.from(new Set(records.map(record => record.lessonName).filter(Boolean) as string[]));

    console.log(`[${actionName}] Successfully fetched ${uniqueLessonNames.length} unique lessons for subject: ${subject}`);
    return { success: true, lessons: uniqueLessonNames, message: "Lessons fetched successfully." };

  } catch (error) {
    let errorMessage = `Failed to fetch lessons for ${subject}.`;
    let errorCode = `GLBSA_E003_FETCH_FAIL_SERVER`;
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching lessons for subject ${subject}:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
      if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found OR no records match filter when fetching lessons for subject '${subject}'. Check PocketBase URL (${pb.baseUrl}) and collection name. Filter: subject = "${subject}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase to view lessons for '${subject}'. PocketBase 'question_bank' View Rule is likely '@request.auth.id != ""'. User ID from token: ${pb.authStore.model?.id || 'N/A'}. Original error: ${error.data?.message || 'No specific message.'}`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pb.baseUrl}) to fetch lessons for subject '${subject}'. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
      } else {
        errorMessage = error.data?.message || `PocketBase error while fetching lessons for '${subject}'. Status: ${error.status}.`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function getQuestionsByLessonAction(subject: string, lessonName: string): Promise<{ success: boolean; questions?: QuestionDisplayInfo[]; message?: string; error?: string; }> {
  const actionName = "Get Questions By Lesson Action";
  console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName}`);
  
  const pb = await getAuthenticatedPbInstance();
  if (!pb) {
     return createErrorResponse(
        "User not authenticated. Please log in to view questions. (GQBLA_NO_AUTH_SERVER)",
        "GQBLA_NO_AUTH_SERVER",
        "Failed to get authenticated PocketBase instance."
    );
  }
  
  console.log(`[${actionName}] User authenticated for fetching questions. User ID: ${pb.authStore.model.id}`);

  try {
    console.log(`[${actionName}] Proceeding to fetch questions for subject: ${subject}, lesson: ${lessonName} using user ${pb.authStore.model.id}.`);
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
    let errorCode = "GQBLA_E002_FETCH_FAIL_SERVER";
    let errorDetails = error instanceof Error ? error.message : String(error);

    console.error(`[${actionName}] Error fetching questions:`, error);

    if (error instanceof ClientResponseError) {
      errorDetails = JSON.stringify(error.data);
       if (error.status === 404) {
        errorMessage = `Collection 'question_bank' not found or no records match. Check PocketBase URL (${pb.baseUrl}) and collection name. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied/Authentication Required (${error.status}) by PocketBase to view questions for '${subject} - ${lessonName}'. PocketBase 'question_bank' View Rule is likely '@request.auth.id != ""'. User ID from token: ${pb.authStore.model?.id || 'N/A'}. Original error: ${error.data?.message || 'No specific message.'}`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase (${pb.baseUrl}) to fetch questions. Check PocketBase server and NEXT_PUBLIC_POCKETBASE_URL.`;
      } else {
         errorMessage = error.data?.message || `PocketBase error: ${error.status}.`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function saveDppAttemptAction(payload: DppAttemptPayload): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
    const actionName = "Save DPP Attempt Action";
    console.log(`[${actionName}] Received payload. Client-provided userId: ${payload.userId}, Subject: ${payload.subject}, Lesson: ${payload.lessonName}`);

    const pb = await getAuthenticatedPbInstance();
    if (!pb) {
        const msg = "User not authenticated. Please log in to save your attempt. (SDPPA_E000A_NO_AUTH)";
        console.log(`[${actionName}] ${msg}`);
        return { success: false, message: msg, error: "SDPPA_E000A_NO_AUTH" };
    }
    
    const authenticatedUserId = pb.authStore.model.id;
    console.log(`[${actionName}] Action authenticated as user: ${authenticatedUserId}. Client-provided userId in payload: ${payload.userId}`);

    // Ensure the attempt is saved for the currently authenticated user, not necessarily who client sent in payload.userId
    if (payload.userId && payload.userId !== authenticatedUserId) {
        console.warn(`[${actionName}] Client-provided userId (${payload.userId}) does not match authenticated user (${authenticatedUserId}). Using authenticated user's ID.`);
    }
    const userIdForRecord = authenticatedUserId;


    const dataToSaveOrUpdate = {
        userId: userIdForRecord, // Always use the authenticated user's ID
        subject: payload.subject,
        lessonName: payload.lessonName,
        attemptDate: new Date().toISOString(),
        questionsAttempted: payload.questionsAttempted,
        score: payload.score,
        totalQuestions: payload.totalQuestions,
    };

    console.log(`[${actionName}] Data prepared for PocketBase (using authenticated user ID ${userIdForRecord}):`, JSON.stringify(dataToSaveOrUpdate, null, 2));

    try {
        const filter = `userId = "${userIdForRecord}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
        console.log(`[${actionName}] Checking for existing attempt for user ${userIdForRecord} with filter: ${filter}`);
        
        let existingAttempt = null;
        try {
            existingAttempt = await pb.collection('dpp_attempts').getFirstListItem(filter);
        } catch (findError) {
            if (findError instanceof ClientResponseError && findError.status === 404) {
                console.log(`[${actionName}] No existing attempt found for user ${userIdForRecord}. Will create a new one.`);
            } else {
                throw findError; // Re-throw other errors during find
            }
        }

        if (existingAttempt) {
            console.log(`[${actionName}] Found existing attempt (ID: ${existingAttempt.id}). Will update.`);
            const updatedRecord = await pb.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
            return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
        } else {
            console.log(`[${actionName}] Attempting to CREATE new dpp_attempts record for user ${userIdForRecord}.`);
            const newRecord = await pb.collection('dpp_attempts').create(dataToSaveOrUpdate);
            console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
            return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
        }
    } catch (error) {
        return handleSaveDppError(error, actionName, userIdForRecord, "Error during save/update attempt.");
    }
}


function handleSaveDppError(
    error: any, 
    actionName: string, 
    userIdAttempted: string | null,
    contextMessage: string
): { success: boolean; message: string; recordId?: string; error?: string; } {
    console.error(`[${actionName}] ${contextMessage} User: ${userIdAttempted || 'anonymous'}. Error:`, error);
    let errorMessage = "Failed to save DPP attempt.";
    let errorCode = "SDPPA_E002_SAVE_FAIL_SERVER";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] Save/Update PocketBase ClientResponseError details: Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
      errorMessage = error.data?.message || errorMessage;
      errorCode = `SDPPA_PB_${error.status}`;
      if (error.status === 403) { 
        errorMessage = `Permission Denied by PocketBase (403): Cannot save/update DPP attempt. Check PocketBase rules for 'dpp_attempts'. User: ${userIdAttempted || 'anonymous'}. Error data: ${JSON.stringify(error.data)}`;
      } else if (error.status === 401) { 
        errorMessage = `Authentication Required by PocketBase (401) to save DPP attempt. Ensure you are logged in.`;
      } else if (error.status === 0) { 
         errorMessage = "Network Error: Could not connect to PocketBase to save DPP attempt.";
      } else if (error.data?.data){ 
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage = `Validation errors from server: ${fieldErrors}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, (error instanceof ClientResponseError ? JSON.stringify(error.response) : String(error)));
}


export async function getLiveReferralStatsAction(): Promise<{
  success: boolean;
  stats?: User['referralStats'];
  message?: string;
  error?: string;
}> {
  const actionName = "Get Live Referral Stats Action";
  console.log(`[${actionName}] Attempting to fetch live referral stats.`);
  
  let adminPb: PocketBase | null = null;
  try {
      adminPb = null; // Removed requirePocketBaseAdmin as it seems it was causing issues.
                      // This action might need re-evaluation if admin rights are strictly needed.
                      // For now, we'll try to proceed if user is authenticated.
      console.warn(`[${actionName}] Admin client fetching logic has been removed. This action's capabilities may be limited without admin privileges.`);
  } catch (adminError) {
      console.error(`[${actionName}] Error trying to get admin client (should not happen if removed):`, adminError);
      const errorMsg = `Admin client initialization failed: ${(adminError as Error).message}. (GLRSA_E001_ADMIN_INIT_FAIL)`;
      console.log(`[${actionName}] Returning error: ${JSON.stringify({ success: false, message: errorMsg, error: "GLRSA_E001_ADMIN_INIT_FAIL" })}`);
      return { success: false, message: errorMsg, error: "GLRSA_E001_ADMIN_INIT_FAIL" };
  }

  const pb = await getAuthenticatedPbInstance();
  if (!pb) {
    const msg = "User not authenticated. Cannot fetch live referral stats. (GLRSA_NO_AUTH_SERVER)";
    console.log(`[${actionName}] ${msg}`);
    return { success: false, message: msg, error: "GLRSA_NO_AUTH_SERVER" };
  }
  
  const currentUser = pb.authStore.model as User;
  console.log(`[${actionName}] Current user authenticated: ${currentUser.id}`);

  if (!currentUser.referralCode) {
    const msg = "Current user does not have a referral code. (GLRSA_NO_REF_CODE)";
    console.log(`[${actionName}] ${msg}`);
    return { success: false, message: msg, error: "GLRSA_NO_REF_CODE", stats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 } };
  }

  // To list users referred by the current user, we would typically need an admin client or very specific API rules.
  // Since we removed the admin client for this iteration, this part will likely not function as intended
  // unless the 'users' collection List Rule is very permissive.
  // For this simplified version, we'll return the current user's own stored referralStats.
  // This does NOT reflect "live" stats of their referrals' current plans.
  // A true "live" calculation would need admin to iterate over all users.
  console.warn(`[${actionName}] Returning stored referral stats for user ${currentUser.id} due to lack of admin client for live calculation. This is not a live calculation of referred users' current plans.`);
  if (currentUser.referralStats) {
      return { success: true, stats: currentUser.referralStats };
  } else {
      const defaultStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
      console.log(`[${actionName}] User ${currentUser.id} has no referralStats. Returning default empty stats.`);
      return { success: true, stats: defaultStats, message: "No referral activity yet (using stored stats)." };
  }
}
