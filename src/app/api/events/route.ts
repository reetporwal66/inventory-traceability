
import { NextResponse } from "next/server";
import clientPromise from "@/lib/db/mongodb";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    const databaseName = process.env.MONGODB_DATABASE;
    const collectionName = process.env.MONGODB_COLLECTION;

    if (!databaseName || !collectionName) {
      return NextResponse.json(
        {
          ok: false,
          message: "MongoDB database configuration is missing.",
        },
        { status: 500 }
      );
    }

    const client = await clientPromise;

    const events = await client
      .db(databaseName)
      .collection(collectionName)
      .find(
        {},
        {
          projection: {
            _id: 0,
            event_id: 1,
            event_type: 1,
            aggregate_type: 1,
            aggregate_id: 1,
            source_created_at: 1,
            copied_at: 1,
            payload: 1,
          },
        }
      )
      .sort({ source_created_at: -1, event_id: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({ ok: true, data: events });
  } catch (error) {
    console.error("Events API failed:", error);

    return NextResponse.json(
      { ok: false, message: "Could not load events from MongoDB." },
      { status: 500 }
    );
  }
}
