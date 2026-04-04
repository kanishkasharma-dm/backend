"use strict";

const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

function getBucketName() {
  return process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || "deck-backend-demo";
}

function sanitizeDoctorName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .substring(0, 100);
}

async function putObject(bucketName, objectConfig) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      ...objectConfig,
    })
  );
}

async function seedDoctorArtifacts(bucketName, doctor) {
  const doctorName = sanitizeDoctorName(doctor.doctor_name);
  const doctorRecord = {
    id: doctor.id,
    doctor_name: doctorName,
    email: doctor.email || null,
    created_at: doctor.created_at || null,
    updated_at: doctor.updated_at || null,
  };

  const objects = [
    {
      Key: `doctor-assigned-reports/${doctorName}/`,
      Body: "",
      ContentType: "application/x-directory",
    },
    {
      Key: `doctor-assigned-reports/${doctorName}/pending/`,
      Body: "",
      ContentType: "application/x-directory",
    },
    {
      Key: `doctor-assigned-reports/${doctorName}/reviewed/`,
      Body: "",
      ContentType: "application/x-directory",
    },
    {
      Key: `doctors/${doctorName}/`,
      Body: "",
      ContentType: "application/x-directory",
    },
    {
      Key: `doctors/${doctorName}/doctor.json`,
      Body: JSON.stringify(doctorRecord, null, 2),
      ContentType: "application/json",
    },
  ];

  for (const objectConfig of objects) {
    await putObject(bucketName, objectConfig);
  }

  return {
    doctor_name: doctorName,
    keysCreated: objects.map((objectConfig) => objectConfig.Key),
  };
}

exports.handler = async (event) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }

    const bucketName = getBucketName();
    const requestBody =
      typeof event?.body === "string" ? JSON.parse(event.body) : event?.body || event || {};

    const doctorNameFilter = sanitizeDoctorName(requestBody.doctor_name || requestBody.doctorName || "");

    let query = supabase
      .from("doctors")
      .select("id, created_at, updated_at, doctor_name, email")
      .order("doctor_name", { ascending: true });

    if (doctorNameFilter) {
      query = query.eq("doctor_name", doctorNameFilter);
    }

    const { data: doctors, error } = await query;
    if (error) {
      throw error;
    }

    const seededDoctors = [];

    for (const doctor of doctors || []) {
      seededDoctors.push(await seedDoctorArtifacts(bucketName, doctor));
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        bucket: bucketName,
        totalSeeded: seededDoctors.length,
        doctors: seededDoctors,
      }),
    };
  } catch (error) {
    console.error("Backfill doctors to S3 error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        message: error.message || "Internal server error",
      }),
    };
  }
};
