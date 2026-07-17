"use client";

import { useEffect, useState } from "react";

// Cheap login-gate check shared by every admin page: probe a route that's
// behind the admin middleware and see whether it 401s. Not a real session
// hook (no refresh/logout here) — just the checked/loggedIn boilerplate
// every admin page needs before it can decide what to render.
export function useAdminAuth(checkUrl) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(checkUrl).then((res) => {
      setLoggedIn(res.ok);
      setChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { loggedIn, checked, setLoggedIn };
}
