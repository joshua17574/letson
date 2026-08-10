import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in .env");
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export default async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
      // Production indexes are installed explicitly by migrations before the
      // application starts writing against them. Avoid background index work
      // racing with requests during a deployment.
      autoIndex: process.env.NODE_ENV !== "production",
      autoCreate: process.env.NODE_ENV !== "production",
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function getMongoDb() {
  const mongooseInstance = await dbConnect();

  if (!mongooseInstance.connection.db) {
    throw new Error("MongoDB database connection is not ready.");
  }

  return mongooseInstance.connection.db;
}
