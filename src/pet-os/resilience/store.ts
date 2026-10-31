import type { DependencyId, DependencyRuntimeState, RecoveryDrill } from './types';

export class ResilienceStore{
  private static instance:ResilienceStore;
  static getInstance(){if(!this.instance)this.instance=new ResilienceStore();return this.instance;}
  private dependencies=new Map<DependencyId,DependencyRuntimeState>();
  private drills=new Map<string,RecoveryDrill>();

  reset(){this.dependencies.clear();this.drills.clear();}
  saveDependency(v:DependencyRuntimeState){this.dependencies.set(v.dependencyId,{...v});return {...v};}
  getDependency(id:DependencyId){const v=this.dependencies.get(id);return v?{...v}:undefined;}
  listDependencies(){return Array.from(this.dependencies.values()).map(v=>({...v}));}
  saveDrill(v:RecoveryDrill){this.drills.set(v.drillId,{...v});return {...v};}
  getDrill(id:string){const v=this.drills.get(id);return v?{...v}:undefined;}
  listDrills(){return Array.from(this.drills.values()).map(v=>({...v})).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));}
}
