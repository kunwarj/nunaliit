package ca.carleton.gcrc.couch.user.db;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.StringWriter;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONObject;

public class MockUserRepository implements UserRepository {

	private Map<String,JSONObject> usersById = new HashMap<String,JSONObject>();
	private Map<String,JSONObject> usersByEmail = new HashMap<String,JSONObject>();
	
	public MockUserRepository(){
		
	}
	
	public JSONObject addUser(String name, String displayName, String emailAddress) throws Exception {
		createUser(name, displayName, "", emailAddress);

		String id = "org.couchdb.user:"+name;
		JSONObject user = usersById.get(id);

		return user;
	}
	
	public void updateUser(JSONObject userDoc) throws Exception {
		String id = userDoc.getString("_id");
		
		JSONObject currentUserDoc = getUserFromId(id);
		
		String currentRev = currentUserDoc.getString("_rev");
		if( false == currentRev.equals(userDoc.get("_rev")) ){
			throw new Exception("Revision mis-match");
		}

		// Replace
		usersById.put(id, userDoc);
		
		// Remove old e-mails
		JSONArray oldEmails = currentUserDoc.optJSONArray("nunaliit_validated_emails");
		if( null != oldEmails ){
			for(int i=0,e=oldEmails.length(); i<e; ++i){
				String oldEmail = oldEmails.getString(i);
				usersByEmail.remove(oldEmail);
			}
		}
		
		// Add new emails
		JSONArray newEmails = currentUserDoc.optJSONArray("nunaliit_validated_emails");
		if( null != newEmails ){
			for(int i=0,e=newEmails.length(); i<e; ++i){
				String newEmail = newEmails.getString(i);
				usersByEmail.put(newEmail,userDoc);
			}
		}
		
		// Update revision
		increaseVersion(userDoc);
	}
	
	@Override
	public Collection<JSONObject> getUsersFromNames(List<String> names) throws Exception {
		List<JSONObject> userDocs = new ArrayList<JSONObject>(names.size());

		for(String n : names){
			String id = "org.couchdb.user:"+n;
			JSONObject user = usersById.get(id);
			userDocs.add(user);
		}
		
		return userDocs;
	}

	@Override
	public JSONObject getUserFromName(String name) throws Exception {
		String id = "org.couchdb.user:"+name;
		return getUserFromId(id);
	}

	@Override
	public JSONObject getUserFromId(String id) throws Exception {
		JSONObject user = usersById.get(id);
		if( null == user ){
			throw new Exception("User not found: "+id);
		}
		return user;
	}

	@Override
	public JSONObject getUserFromEmailAddress(String emailAddress) throws Exception {
		JSONObject user = usersByEmail.get(emailAddress);
		if( null == user ){
			throw new Exception("User not found. Email: "+emailAddress);
		}
		return user;
	}

	@Override
	public void createUser(
			String name, 
			String displayName, 
			String password,
			String emailAddress) throws Exception {
		JSONObject user = new JSONObject();
		
		String id = "org.couchdb.user:"+name;
		usersById.put(id, user);
		
		user.put("_id", id);
		user.put("name", name);
		user.put("password", password);
		user.put("type", "user");
		user.put("roles", new JSONArray());
		user.put("nunaliit_options", new JSONObject());
		user.put("nunaliit_emails", new JSONArray());
		user.put("nunaliit_validated_emails", new JSONArray());

		increaseVersion(user);

		if( null != displayName ){
			user.put("display", displayName);
		}

		if( null != emailAddress ){
			JSONArray validatedEmails = user.getJSONArray("nunaliit_validated_emails");
			validatedEmails.put(emailAddress);
			
			usersByEmail.put(emailAddress, user);
		}
	}

	@Override
	public void recoverPassword(String name, String newPassword) throws Exception {
		JSONObject user = getUserFromName(name);
		user.put("password", newPassword);
		
		// Increase version
		increaseVersion(user);
	}
	
	private void increaseVersion(JSONObject doc) throws Exception {
		String currentRev = doc.optString("_rev","0-abcde");
		String[] components = currentRev.split("-");
		int version = Integer.parseInt( components[0] );
		int nextVersion = version + 1;
		
		ByteArrayOutputStream baos = new ByteArrayOutputStream();
		OutputStreamWriter osw = new OutputStreamWriter(baos,"UTF-8");
		osw.write(doc.optString("_id",""));
		osw.write(""+nextVersion);
		osw.flush();

		MessageDigest md = MessageDigest.getInstance("SHA-1");
		byte[] digest = md.digest(baos.toByteArray());
		
		StringWriter sw = new StringWriter();
		sw.write(""+nextVersion);
		sw.write("-");
		for(byte b : digest){
			String hex = String.format("%1$02x", b);
			sw.write(hex);
		}
		sw.flush();
		
		doc.put("_rev", sw.toString());
	}
}
