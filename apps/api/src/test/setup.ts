process.env.JWT_ACCESS_SECRET ||= "test-access-secret-do-not-use-in-prod";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-do-not-use-in-prod";
process.env.MFA_CHALLENGE_SECRET ||= "test-mfa-challenge-secret-do-not-use-in-prod";
process.env.SECRET_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString("base64");
process.env.MFA_CHALLENGE_TTL_SECONDS ||= "300";
process.env.ACCESS_TOKEN_TTL_SECONDS ||= "900";
process.env.REFRESH_TOKEN_TTL_SECONDS ||= "2592000";
