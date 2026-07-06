import {
  QueryConstraint,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import type { Contact } from './types';

/** All docs carry their id; strip it before writing, restore it after reading. */
export function withId<T extends { id: string }>(id: string, data: DocumentData): T {
  return { ...(data as Omit<T, 'id'>), id } as T;
}

export function stripId<T extends { id: string }>(obj: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = obj;
  return rest;
}

export async function fetchAll<T extends { id: string }>(
  name: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const snap = await getDocs(query(collection(db, name), ...constraints));
  return snap.docs.map((d) => withId<T>(d.id, d.data()));
}

export function newId(name: string): string {
  return doc(collection(db, name)).id;
}

export async function saveDoc(name: string, id: string, data: DocumentData): Promise<void> {
  await setDoc(doc(db, name, id), data);
}

export async function patchDoc(name: string, id: string, data: DocumentData): Promise<void> {
  await updateDoc(doc(db, name, id), data);
}

export async function removeDoc(name: string, id: string): Promise<void> {
  await deleteDoc(doc(db, name, id));
}

/**
 * Contacts double as coach authorization: `coachIndex/{email}` lists the teams
 * a coach can act on, and Firestore rules read it. Keep it in sync here.
 */
export async function saveContact(contact: Contact): Promise<void> {
  const email = contact.email.trim().toLowerCase();
  const batch = writeBatch(db);
  batch.set(doc(db, 'contacts', contact.id), { ...stripId(contact), email });
  batch.set(doc(db, 'coachIndex', email), { teamIds: arrayUnion(contact.teamId) }, { merge: true });
  await batch.commit();
}

export async function deleteContact(contact: Contact): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'contacts', contact.id));
  batch.set(
    doc(db, 'coachIndex', contact.email),
    { teamIds: arrayRemove(contact.teamId) },
    { merge: true },
  );
  await batch.commit();
}
