import type { Vector3 } from 'three';

export interface ParsedMesh {
  vertices: Vector3[];
  faces: number[][];
}

export interface Vertex {
  readonly index: number;
  halfEdge: HalfEdge | null;
}

export interface HalfEdge {
  readonly index: number;
  origin: Vertex;
  twin: HalfEdge | null;
  next: HalfEdge;
  face: Face | null;
}

export interface Face {
  readonly index: number;
  halfEdge: HalfEdge;
}
