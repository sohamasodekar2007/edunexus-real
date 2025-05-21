
// @ts-nocheck
'use server';
import pbGlobal from '@/lib/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { LoginSchema, SignupSchema, type SignupFormData } from '@/lib/validationSchemas';
import { generateReferralCode } from '@/lib/authUtils';
import { createUserInPocketBase, findUserByReferralCode, updateUserReferralStats, findUserById, updateUserInPocketBase } from '@/lib/userDataService';
import type { User, UserModel, UserRole, UserClass, QuestionDisplayInfo, PYQInfo, DppAttemptPayload } from '@/types';
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
    return { success: false, message: "" }; // No message for too short codes.
  }
  console.log(`[${actionName}] Validating code: ${upperCaseCode}`);

  try {
    const referrer = await findUserByReferralCode(upperCaseCode, pbGlobal);
    if (referrer) {
      console.log(`[${actionName}] Valid referrer found: ${referrer.name}`);
      return { success: true, message: `This referral code belongs to ${referrer.name}.`, referrerName: referrer.name };
    } else {
      console.log(`[${actionName}] No referrer found for code: ${upperCaseCode}`);
      return { success: false, message: "" }; // No "invalid code" message to user.
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
      referredByCode: upperCaseReferredByCode, // Store the entered code regardless of its validity
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
      const referrerToUpdateStats = await findUserByReferralCode(upperCaseReferredByCode, pbGlobal); 
      if (referrerToUpdateStats && referrerToUpdateStats.id) {
        console.log(`[${actionName}] Found referrer: ${referrerToUpdateStats.id} (${referrerToUpdateStats.name}). Current stats:`, referrerToUpdateStats.referralStats);

        const currentStats = referrerToUpdateStats.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0, referred_dpp: 0 };
        const newReferrerStats: User['referralStats'] = {
          ...currentStats,
          referred_free: (currentStats.referred_free || 0) + 1,
        };
        
        try {
            await updateUserReferralStats(referrerToUpdateStats.id, newReferrerStats, pbGlobal);
            console.log(`[${actionName}] Successfully attempted referral stats update for referrer ${referrerToUpdateStats.name} to`, newReferrerStats);
        } catch (statsUpdateError) {
            console.warn(`[${actionName}] Failed to update referral stats for referrer ${referrerToUpdateStats.name} using standard auth. PocketBase rules might restrict this if not an admin operation. Error:`, statsUpdateError.message);
        }
      } else {
        console.warn(`[${actionName}] No valid referrer found with code ${upperCaseReferredByCode} when attempting to update stats. Stats not updated. Entered code was still saved on new user's 'referredByCode' field.`);
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
  userId, 
  classToUpdate,
  targetYearToUpdate
}: {
  userId: string,
  classToUpdate?: UserClass | '',
  targetYearToUpdate?: string
}): Promise<{ success: boolean; message: string; error?: string; updatedUser?: User }> {
  const actionName = "Update User Profile Action";
  console.log(`[${actionName}] Attempting to update profile for user ID: ${userId} with class: ${classToUpdate}, targetYear: ${targetYearToUpdate}`);

  if (!pbGlobal.authStore.isValid || pbGlobal.authStore.model?.id !== userId) {
    console.warn(`[${actionName}] Update Denied or Auth Context Mismatch: Server action's pbGlobal.authStore.model?.id (${pbGlobal.authStore.model?.id}) might not match target userId (${userId}) or isn't valid. Relying on PocketBase's rule @request.auth.id = id.`);
  }
  
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
    const updatedUserRecord = await updateUserInPocketBase(userId, dataForPocketBase, pbGlobal);
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
        errorMessage = "Permission Denied (403): You may not have permission to update this profile. Ensure PocketBase 'users' collection updateRule is correctly set (e.g., @request.auth.id = id) and the request is authenticated as this user.";
        errorCode = "UPA_PB_403_FORBIDDEN";
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not update profile.`;
        errorCode = "UPA_PB_404_NOT_FOUND";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to update profile.";
        errorCode = "UPA_PB_0_NET_ERR";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function getReferrerInfoForCurrentUserAction(): Promise<{ referrerName: string | null; error?: string }> {
  const actionName = "Get Referrer Info Action";

  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    console.warn(`[${actionName}] Current user not authenticated in pbGlobal.authStore. Cannot determine referredByCode.`);
    return { referrerName: null, error: "User not authenticated to fetch referrer info." };
  }
  const currentAuthUserId = pbGlobal.authStore.model.id;
  const currentUserReferredByCode = pbGlobal.authStore.model.referredByCode as string | undefined;

  if (!currentUserReferredByCode || currentUserReferredByCode.trim() === '') {
    console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was not referred or referredByCode is not set.`);
    return { referrerName: null };
  }
  console.log(`[${actionName}] Current user (ID: ${currentAuthUserId}) was referred by code: ${currentUserReferredByCode}. Fetching referrer...`);

  try {
    const referrer = await findUserByReferralCode(currentUserReferredByCode, pbGlobal);
    if (referrer && referrer.name) {
      console.log(`[${actionName}] Found referrer (ID: ${referrer.id}, Name: ${referrer.name}) for code: ${currentUserReferredByCode}.`);
      return { referrerName: referrer.name };
    } else {
      console.warn(`[${actionName}] Referrer with code ${currentUserReferredByCode} not found, or name is missing.`);
      return { referrerName: null, error: `Referrer with code ${currentUserReferredByCode} not found, or name is missing.`};
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${actionName}] Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`);
    return { referrerName: null, error: `Error fetching referrer by code ${currentUserReferredByCode}: ${errorMessage}.`};
  }
}

export async function updateUserAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Update User Avatar Action";
  
  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Please log in to update your avatar.", "UAA_E001_NO_AUTH_SERVER");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Updating avatar for user ID: ${userId}. formData keys: ${Array.from(formData.keys()).join(', ')}`);

  try {
    const updatedRecord = await updateUserInPocketBase(userId, formData, pbGlobal);
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
        errorMessage = "Permission Denied (403): You may not have permission to update this avatar. Ensure PocketBase 'users' collection updateRule is '@request.auth.id = id' and the request is authenticated as this user.";
        errorCode = "UAA_PB_403_FORBIDDEN";
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not update avatar.`;
        errorCode = "UAA_PB_404_NOT_FOUND";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to update avatar.";
        errorCode = "UAA_PB_0_NET_ERR";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, errorMessage);
  }
}

export async function removeUserAvatarAction(): Promise<{ success: boolean; message: string; error?: string; updatedUserRecord?: any }> {
  const actionName = "Remove User Avatar Action";

  if (!pbGlobal.authStore.isValid || !pbGlobal.authStore.model?.id) {
    return createErrorResponse("User not authenticated. Please log in to remove your avatar.", "RAA_E001_NO_AUTH_SERVER");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Removing avatar for user ID: ${userId}.`);

  try {
    const updatedRecord = await updateUserInPocketBase(userId, { 'avatar': null }, pbGlobal);
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
        errorMessage = "Permission Denied (403): You may not have permission to remove this avatar. Ensure PocketBase 'users' collection updateRule is '@request.auth.id = id' and the request is authenticated as this user.";
        errorCode = "RAA_PB_403_FORBIDDEN";
      } else if (error.status === 404) {
        errorMessage = `User not found (ID: ${userId}). Could not remove avatar.`;
        errorCode = "RAA_PB_404_NOT_FOUND";
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to remove avatar.";
        errorCode = "RAA_PB_0_NET_ERR";
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
  
  // This action now relies on the client-side guard in admin-panel/layout.tsx
  // and PocketBase's 'question_bank' collection "Create Rule".
  // If "Create Rule" is "", no server-side auth check is needed for this action itself.
  // If "Create Rule" is "@request.auth.id != "" && @request.auth.role = "Admin"",
  // PocketBase will enforce it based on the token sent with the request.

  try {
    const newQuestionRecord = await pbGlobal.collection('question_bank').create(formData);
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
        errorMessage = `Permission Denied (403): The current user (or unauthenticated context) does not have permission to add questions. Ensure PocketBase 'question_bank' collection Create Rule is correctly set (e.g., "" for public, or "@request.auth.id != "" && @request.auth.role = "Admin"" and the request is authenticated as Admin). Server auth status: ${pbGlobal.authStore.isValid}, role: ${pbGlobal.authStore.model?.role || 'unknown'}.`;
        errorCode = "AQA_E004_PB_403";
      } else if (error.status === 401) { 
         errorMessage = `Authentication Required (401): User is not authenticated or token is invalid. Please log in. Server saw auth status: ${pbGlobal.authStore.isValid}.`;
        errorCode = "AQA_E004B_PB_401";
      } else if (detailedFieldErrors) {
        errorMessage = `Failed to create record due to validation errors. Details: ${detailedFieldErrors}`;
        errorCode = "AQA_E005_PB_VALIDATION";
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to add the question. Please check your internet connection and the server status.";
        errorCode = "AQA_E006_PB_NET_ERR";
      } else {
        errorMessage = `Failed to create record. Please check inputs. (Status: ${error.status})`;
        errorCode = `AQA_E007_PB_${error.status}`;
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
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pbGlobal.baseUrl}`);

  if (!subject) {
    return createErrorResponse("Subject is required to fetch lessons.", "GLBSA_E002_NO_SUBJECT");
  }

  try {
    const records = await pbGlobal.collection('question_bank').getFullList({
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
        errorMessage = `Collection 'question_bank' not found (or no records match) when fetching lessons for subject '${subject}'. Ensure collection name is correct and PocketBase URL in .env is the root URL (eg. https://your-domain.com). Current URL used by SDK: ${pbGlobal.baseUrl}. Filter: subject = "${subject}"`;
        errorCode = `GLBSA_E006_PB_404`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied (${error.status}): You may not have permission to view lessons. Please ensure you are logged in and your PocketBase 'question_bank' View/List Rule allows access (e.g., "@request.auth.id != """). Server saw auth status: ${pbGlobal.authStore.isValid}.`;
        errorCode = `GLBSA_E005_PB_AUTH`;
      } else if (error.status === 0) {
        errorMessage = `Network Error: Could not connect to PocketBase to fetch lessons for subject '${subject}'.`;
        errorCode = `GLBSA_E007_PB_0`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}


export async function getQuestionsByLessonAction(subject: string, lessonName: string): Promise<{ success: boolean; questions?: QuestionDisplayInfo[]; message?: string; error?: string; }> {
  const actionName = "Get Questions By Lesson Action";
  console.log(`[${actionName}] Attempting to fetch questions for subject: ${subject}, lesson: ${lessonName}`);
  console.log(`[${actionName}] Using PocketBase instance with baseUrl: ${pbGlobal.baseUrl}`);

  if (!subject || !lessonName) {
    return createErrorResponse("Subject and Lesson Name are required.", "GQBLA_E001_MISSING_PARAMS");
  }
  
  try {
    const records = await pbGlobal.collection('question_bank').getFullList({
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
        questionImage: record.questionImage ? pbGlobal.getFileUrl(record, record.questionImage) : undefined,
        optionsFormat: record.optionsFormat || undefined,
        optionAText: record.optionAText || undefined,
        optionAImage: record.optionAImage ? pbGlobal.getFileUrl(record, record.optionAImage) : undefined,
        optionBText: record.optionBText || undefined,
        optionBImage: record.optionBImage ? pbGlobal.getFileUrl(record, record.optionBImage) : undefined,
        optionCText: record.optionCText || undefined,
        optionCImage: record.optionCImage ? pbGlobal.getFileUrl(record, record.optionCImage) : undefined,
        optionDText: record.optionDText || undefined,
        optionDImage: record.optionDImage ? pbGlobal.getFileUrl(record, record.optionDImage) : undefined,
        correctOption: record.correctOption,
        explanationText: record.explanationText || undefined,
        explanationImage: record.explanationImage ? pbGlobal.getFileUrl(record, record.explanationImage) : undefined,
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
        errorMessage = `Collection 'question_bank' not found or no records match. Ensure collection name is correct and PocketBase URL in .env is the root URL. Current URL used: ${pbGlobal.baseUrl}. Filter: subject = "${subject}" && lessonName = "${lessonName}"`;
        errorCode = `GQBLA_E004_PB_404`;
      } else if (error.status === 401 || error.status === 403) {
        errorMessage = `Permission Denied (${error.status}): You may not have permission to view questions. Please ensure you are logged in and your PocketBase 'question_bank' View Rule allows access (e.g., "@request.auth.id != """). Server saw auth status: ${pbGlobal.authStore.isValid}.`;
        errorCode = `GQBLA_E005_PB_AUTH`;
      } else if (error.status === 0) {
        errorMessage = "Network Error: Could not connect to PocketBase to fetch questions.";
        errorCode = `GQBLA_E005_PB_0`;
      }
      console.error(`[${actionName}] PocketBase ClientResponseError details: URL: ${error.url}, Status: ${error.status}, Response: ${JSON.stringify(error.response)}`);
    }
    return createErrorResponse(errorMessage, errorCode, errorDetails);
  }
}

export async function saveDppAttemptAction(payload: DppAttemptPayload): Promise<{ success: boolean; message: string; recordId?: string; error?: string; }> {
  const actionName = "Save DPP Attempt Action";
  console.log(`[${actionName}] Received payload:`, JSON.stringify(payload, null, 2));

  // Rely on PocketBase "Create Rule" for dpp_attempts collection: @request.auth.id != ""
  // The pbGlobal instance should carry the client's auth token when action is invoked.
  // However, ensure the user IS actually logged in on the client before this action is even callable.
  // The client-side logic should check pb.authStore.isValid before allowing submission.
  
  // Additional check: The pbGlobal instance on server-side for server actions might not have client's auth by default.
  // This depends on Next.js version & how auth context is propagated.
  // If pbGlobal.authStore.model.id is undefined here, the action will fail.
  if (!pbGlobal.authStore.model?.id) {
    console.warn(`[${actionName}] pbGlobal.authStore.model.id is undefined on server. This implies the client's auth context wasn't available or wasn't propagated to the server action's pbGlobal instance. Ensure client is authenticated before calling.`);
    return createErrorResponse("User authentication context not found on server. Cannot save DPP attempt.", "SDPPA_E001B_NO_AUTH_CONTEXT_SERVER");
  }
  const userId = pbGlobal.authStore.model.id;
  console.log(`[${actionName}] Authenticated User ID from pbGlobal.authStore.model.id: ${userId}`);

  const dataToSaveOrUpdate = {
    userId: userId, 
    subject: payload.subject,
    lessonName: payload.lessonName,
    attemptDate: new Date().toISOString(),
    questionsAttempted: payload.questionsAttempted,
    score: payload.score,
    totalQuestions: payload.totalQuestions,
  };
  console.log(`[${actionName}] Data prepared for save/update:`, JSON.stringify(dataToSaveOrUpdate, null, 2));

  try {
    let existingAttempt = null;
    const filter = `userId = "${userId}" && subject = "${payload.subject}" && lessonName = "${payload.lessonName}"`;
    console.log(`[${actionName}] Checking for existing attempt with filter: ${filter}`);
    try {
      existingAttempt = await pbGlobal.collection('dpp_attempts').getFirstListItem(filter);
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
      console.log(`[${actionName}] Updating existing attempt ID: ${existingAttempt.id}`);
      // PocketBase rule for update: @request.auth.id == userId (user can update their own)
      const updatedRecord = await pbGlobal.collection('dpp_attempts').update(existingAttempt.id, dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt updated successfully. Record ID: ${updatedRecord.id}`);
      return { success: true, message: "DPP attempt updated successfully!", recordId: updatedRecord.id };
    } else {
      console.log(`[${actionName}] Creating new DPP attempt.`);
      // PocketBase rule for create: @request.auth.id != "" (user can create, server ensures userId is set)
      const newRecord = await pbGlobal.collection('dpp_attempts').create(dataToSaveOrUpdate);
      console.log(`[${actionName}] DPP attempt saved successfully. Record ID: ${newRecord.id}`);
      return { success: true, message: "DPP attempt saved successfully!", recordId: newRecord.id };
    }

  } catch (error) {
    console.error(`[${actionName}] Error saving/updating DPP attempt:`, error);
    let errorMessage = "Failed to save DPP attempt.";
    let errorCode = "SDPPA_E002_SAVE_FAIL";
    if (error instanceof ClientResponseError) {
      console.error(`[${actionName}] Save/Update Error Details:`, JSON.stringify(error.data));
      errorMessage = error.data?.message || errorMessage;
      errorCode = `SDPPA_PB_${error.status}`;
      if (error.status === 403) { // Permission Denied
        errorMessage = `Permission Denied (403): You may not have permission to save/update this DPP attempt. Check PocketBase rules for 'dpp_attempts' collection. (User: ${userId}, Subject: ${payload.subject}, Lesson: ${payload.lessonName})`;
      } else if (error.status === 401) { // Unauthorized (e.g. token expired or invalid)
        errorMessage = `Authentication Required (401) to save DPP attempt. Please ensure you are logged in.`;
      } else if (error.status === 0) { // Network Error
         errorMessage = "Network Error: Could not connect to PocketBase to save DPP attempt.";
      } else if (error.data?.data){ // Validation errors from PocketBase
        const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        errorMessage = `Validation errors from server: ${fieldErrors}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return createErrorResponse(errorMessage, errorCode, (error instanceof ClientResponseError ? JSON.stringify(error.data) : String(error)));
  }
}
// Ensure this is the last line of actual code.
// Removed getLiveReferralStatsAction as it was marked for removal or not needed.
