import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db/mysql";
import { createSession, type UserRole } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password || email.length > 255 || password.length > 1024) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid email and password." },
        { status: 400 },
      );
    }

    const [rows] = await pool.execute(
      `SELECT user_id, full_name, email, password_hash, role
       FROM app_users
       WHERE email = ? AND is_active = 1
       LIMIT 1`,
      [email],
    );

    const users = rows as Array<{
      user_id: number;
      full_name: string;
      email: string;
      password_hash: string;
      role: UserRole;
    }>;

    const user = users[0];

    if (!user || !(await bcrypt.compare(password, user?.password_hash ?? ""))) {
      return NextResponse.json(
        { ok: false, message: "Invalid email or password." },
        { status: 401 },
      );
    }

    if (!["ADMIN", "INVENTORY_STAFF", "QUALITY_STAFF"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, message: "Invalid account role." },
        { status: 403 },
      );
    }

    await createSession({
      userId: Number(user.user_id),
      name: user.full_name,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      ok: true,
      user: {
        name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { ok: false, message: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
