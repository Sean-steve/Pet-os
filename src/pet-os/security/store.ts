import type { PrivacyRequest, SecurityIncident } from './types';

export class SecurityStore{
  private static instance:SecurityStore;
  static getInstance(){if(!this.instance)this.instance=new SecurityStore();return this.instance;}
  private privacyRequests=new Map<string,PrivacyRequest>();
  private incidents=new Map<string,SecurityIncident>();
  reset(){this.privacyRequests.clear();this.incidents.clear();}
  savePrivacyRequest(v:PrivacyRequest){this.privacyRequests.set(v.requestId,{...v});return {...v};}
  getPrivacyRequest(id:string){const v=this.privacyRequests.get(id);return v?{...v}:undefined;}
  listPrivacyRequests(){return Array.from(this.privacyRequests.values()).map(v=>({...v}));}
  saveIncident(v:SecurityIncident){this.incidents.set(v.incidentId,{...v,affectedDataClasses:[...v.affectedDataClasses]});return {...v,affectedDataClasses:[...v.affectedDataClasses]};}
  listIncidents(){return Array.from(this.incidents.values()).map(v=>({...v,affectedDataClasses:[...v.affectedDataClasses]}));}
}