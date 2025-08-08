// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/app/utils/auth";

export const { GET, POST } = handlers;
